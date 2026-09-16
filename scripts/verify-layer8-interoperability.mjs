import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MemoryIdentityLinkStore } from "../apps/api/dist/integrations/identity-link-store.js";
import { createIdentityLinkService } from "../apps/api/dist/integrations/identity-links.js";
import { createLayer8PolicyClient } from "../apps/api/dist/integrations/layer8.js";

const layer8 = resolve(process.env.LAYER8_REPO_PATH ?? "../layer8-integration");
const python = join(layer8, ".venv", "bin", "python");
const server = join(layer8, "scripts", "virtuapet_interop_server.py");
const temp = await mkdtemp(join(tmpdir(), "vp-layer8-interop-"));
const child = spawn(python, [server, "--database", join(temp, "layer8.sqlite")],
  { cwd: layer8, stdio: ["pipe", "pipe", "pipe"] });
let stderr = "";
child.stderr.on("data", chunk => { if (stderr.length < 4096) stderr += chunk.toString(); });
const pending = new Map();
createInterface({ input: child.stdout }).on("line", line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const resolver = pending.get(message.id);
  if (resolver) { pending.delete(message.id); resolver(message); }
});
function rpc(message) {
  const id = randomUUID();
  return new Promise((resolveReply, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("Layer8 fixture timeout")); }, 5000);
    pending.set(id, reply => { clearTimeout(timer); resolveReply(reply); });
    child.stdin.write(`${JSON.stringify({ id, ...message })}\n`);
  });
}

try {
  const fixtureReply = await rpc({ operation: "fixture" });
  assert.equal(fixtureReply.ok, true);
  const fixture = fixtureReply.body;
  const context = { tenantId: fixture.tenantId, userId: fixture.subject, roles: ["guardian"], correlationId: randomUUID() };
  const links = createIdentityLinkService({ enabled: true, store: new MemoryIdentityLinkStore(), issuer: fixture.issuer,
    audience: fixture.linkAudience, pinnedKid: fixture.kid, publicJwks: fixture.publicJwks,
    encryptionKeyBase64: randomBytes(32).toString("base64") });
  assert.ok(links);
  const challenge = await links.createChallenge(context);
  const linkResponse = await rpc({ operation: "request", method: "POST", path: "/v1/integrations/virtuapet/link-proof",
    headers: { authorization: `Bearer ${fixture.clerkToken}` }, json: { subject: context.userId, tenantId: context.tenantId,
      challengeId: challenge.challengeId, nonce: challenge.nonce } });
  assert.equal(linkResponse.status, 200);
  assert.equal(linkResponse.headers["cache-control"], "no-store");
  const { proofToken } = linkResponse.body;
  await links.complete(context, { challengeId: challenge.challengeId, proofToken, consent: true });
  const policy = createLayer8PolicyClient({ enabled: true,
    endpoint: "https://layer8.example.com/v1/integrations/virtuapet/policy",
    tenantServiceTokens: { [context.tenantId]: fixture.apiKey }, issuer: fixture.issuer,
    audience: fixture.policyAudience, publicJwks: fixture.publicJwks }, {
    resolveIdentityProof: async requested => links.resolveProof(requested),
    fetch: async (_input, init) => {
      const response = await rpc({ operation: "request", method: "POST", path: "/v1/integrations/virtuapet/policy",
        headers: Object.fromEntries(new Headers(init.headers)), json: JSON.parse(init.body) });
      return new Response(JSON.stringify(response.body), { status: response.status,
        headers: { "content-type": "application/json", "cache-control": response.headers["cache-control"] } });
    }
  });
  const allowed = await policy.authorize(context, { action: "spatial.preview.read",
    resource: `pawsome3d:order:${randomUUID()}`, purpose: "owner_visual_preview",
    requiredEntitlements: ["spatial.preview"] });
  assert.equal(allowed.outcome, "allow");
  assert.deepEqual(allowed.entitlements, ["spatial.preview"]);
  assert.equal(allowed.correlationId, context.correlationId);
  console.log("PASS real Layer8 link proof -> VirtuaPet encrypted link -> real Layer8 policy -> VirtuaPet verification");
} catch (error) {
  console.error(`Layer8 interoperability failed: ${error?.message ?? "unknown error"}`);
  if (stderr) console.error("Layer8 fixture emitted an error; inspect locally without sharing fixture values");
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
}
