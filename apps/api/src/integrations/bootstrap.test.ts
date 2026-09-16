import { randomBytes } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { identityLinksFromEnvironment } from "./bootstrap.js";
import { MemoryIdentityLinkStore } from "./identity-link-store.js";

describe("server identity-link configuration", () => {
  it("is disabled by default and has no automatic memory fallback", () => {
    expect(identityLinksFromEnvironment(undefined, {})).toBeUndefined();
    expect(identityLinksFromEnvironment(undefined, { LAYER8_IDENTITY_LINKS_ENABLED: "true" })).toBeUndefined();
    expect(identityLinksFromEnvironment(new MemoryIdentityLinkStore(), {})).toBeUndefined();
  });
  it("requires complete public trust and encryption configuration", async () => {
    const { publicKey } = await generateKeyPair("ES256");
    const env = { LAYER8_IDENTITY_LINKS_ENABLED: "true", LAYER8_LINK_ISSUER: "https://api.example.com",
      LAYER8_LINK_AUDIENCE: "virtuapet-links", LAYER8_LINK_KEY_ID: "fixture-key",
      LAYER8_LINK_JWKS_JSON: JSON.stringify({ keys: [{ ...await exportJWK(publicKey), kid: "fixture-key" }] }),
      INTEGRATION_LINK_ENCRYPTION_KEY_BASE64: randomBytes(32).toString("base64") };
    const store = new MemoryIdentityLinkStore();
    expect(identityLinksFromEnvironment(store, env)).toBeDefined();
    for (const key of Object.keys(env)) {
      const invalid: NodeJS.ProcessEnv = { ...env }; delete invalid[key];
      expect(identityLinksFromEnvironment(store, invalid)).toBeUndefined();
    }
    for (const value of ["not-json", "null", "{}", '{"keys":[{}]}']) {
      expect(identityLinksFromEnvironment(store, { ...env, LAYER8_LINK_JWKS_JSON: value })).toBeUndefined();
    }
    expect(identityLinksFromEnvironment(store, { ...env, INTEGRATION_LINK_ENCRYPTION_KEY_BASE64: "not-a-key" })).toBeUndefined();
  });
});
