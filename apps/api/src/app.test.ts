import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { PrincipalVerifier } from "./auth.js";

const guardian = "04240ca7-5f6b-497b-89f8-dd4aad574a60";
const veterinarian = "27138277-7967-4059-b8ab-6041b2497e5d";
const clinic = "5a0a47a1-402e-437b-8082-f123402ab9d7";
const reviewer = "394c6b7d-d2bf-49e1-acbf-e9490b990146";
const verifier: PrincipalVerifier = async request => {
  const kind = request.headers["x-test-principal"];
  if (kind === "guardian") return { userId: guardian, roles: ["guardian"] };
  if (kind === "vet") return { userId: veterinarian, organizationId: clinic, roles: ["veterinarian"] };
  if (kind === "reviewer") return { userId: reviewer, roles: ["regulatory_reviewer"] };
  return undefined;
};
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
const headers = (kind: string) => ({ "x-test-principal": kind });

afterEach(async () => { await app?.close(); app = undefined; });

async function createPet() {
  const response = await app!.inject({ method: "POST", url: "/v1/pets", headers: headers("guardian"), payload: { name: "Milo", species: "cat" } });
  expect(response.statusCode).toBe(201);
  return response.json();
}

describe("VirtuaPet Phase 2 API", () => {
  it("reports health and injected identity readiness", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/readyz" })).json().dependencies.identityVerifier).toBe("injected");
  });

  it("protects profile access and hides another guardian's pet", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    expect((await app.inject({ method: "POST", url: "/v1/pets", payload: { name: "Milo", species: "cat" } })).statusCode).toBe(401);
    const pet = await createPet();
    expect((await app.inject({ method: "GET", url: `/v1/pets/${pet.petId}`, headers: headers("guardian") })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/v1/pets/${pet.petId}`, headers: headers("vet") })).statusCode).toBe(404);
  });

  it("creates and revokes a time-limited clinic grant", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    const pet = await createPet();
    const created = await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/consents`, headers: headers("guardian"), payload: { granteeId: clinic, scopes: ["pet.health.summary.read", "pet.health.observation.write"], expiresAt: "2027-09-14T18:00:00.000Z", purpose: "Clinic pain assessment" } });
    expect(created.statusCode).toBe(201);
    const grant = created.json();
    const revoked = await app.inject({ method: "DELETE", url: `/v1/pets/${pet.petId}/consents/${grant.grantId}`, headers: headers("guardian") });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().revokedAt).toBeTruthy();
  });

  it("requires active consent before a trained clinic assessor can record FGS", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    const pet = await createPet();
    const payload = { assessedAt: "2026-09-14T18:00:00.000Z", assessorTrainingConfirmed: true, actionUnits: { earPosition: 1, orbitalTightening: 1, muzzleTension: 1, whiskersPosition: 1, headPosition: 0 } };
    expect((await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/feline-grimace-assessments`, headers: headers("vet"), payload })).statusCode).toBe(403);
    await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/consents`, headers: headers("guardian"), payload: { granteeId: clinic, scopes: ["pet.health.summary.read", "pet.health.observation.write"], expiresAt: "2027-09-14T18:00:00.000Z", purpose: "Clinic pain assessment" } });
    const scored = await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/feline-grimace-assessments`, headers: headers("vet"), payload });
    expect(scored.statusCode).toBe(201);
    expect(scored.json()).toMatchObject({ totalScore: 4, veterinaryReviewRequired: true, assessorTrainingConfirmed: true });
  });

  it("fails unsupported regulation queries closed", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    const result = await app.inject({ method: "GET", url: "/v1/regulations/evidence?countryCode=US", headers: headers("guardian") });
    expect(result.json()).toMatchObject({ evidence: [], checklistStatus: "unsupported" });
  });

  it("limits regulation evidence creation to reviewers", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    const payload = { countryCode: "US", regionCode: "CO", authority: "Colorado Department of Agriculture", sourceUrl: "https://ag.colorado.gov/", title: "Official animal health source", retrievedAt: "2026-09-14T18:00:00.000Z", evidenceExcerpt: "Official source must be reviewed before checklist use.", status: "current" };
    expect((await app.inject({ method: "POST", url: "/v1/regulations/evidence", headers: headers("guardian"), payload })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/regulations/evidence", headers: headers("reviewer"), payload })).statusCode).toBe(201);
  });
});
