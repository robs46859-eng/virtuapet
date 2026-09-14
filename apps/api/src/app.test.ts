import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { PrincipalVerifier } from "./auth.js";

const guardian = "04240ca7-5f6b-497b-89f8-dd4aad574a60";
const veterinarian = "27138277-7967-4059-b8ab-6041b2497e5d";
const clinic = "5a0a47a1-402e-437b-8082-f123402ab9d7";
const reviewer = "394c6b7d-d2bf-49e1-acbf-e9490b990146";
const platformAdmin = "8b149ab0-04a6-4b4f-8c69-ff50613e2705";
const verifier: PrincipalVerifier = async request => {
  const kind = request.headers["x-test-principal"];
  if (kind === "guardian") return { userId: guardian, roles: ["guardian"] };
  if (kind === "vet") return { userId: veterinarian, organizationId: String(request.headers["x-test-org"] ?? clinic), roles: [] };
  if (kind === "reviewer") return { userId: reviewer, roles: ["regulatory_reviewer"] };
  if (kind === "platform") return { userId: platformAdmin, roles: ["platform_admin"] };
  if (kind === "clinic-admin") return { userId: platformAdmin, organizationId: clinic, roles: [] };
  return undefined;
};
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
const headers = (kind: string) => ({ "x-test-principal": kind });
const future = () => new Date(Date.now() + 3_600_000).toISOString();

afterEach(async () => { await app?.close(); app = undefined; });

async function createPet() {
  const response = await app!.inject({ method: "POST", url: "/v1/pets", headers: headers("guardian"), payload: { name: "Milo", species: "cat" } });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function createClinic() {
  const created=await app!.inject({method:"POST",url:"/v1/organizations",headers:headers("platform"),payload:{name:"VirtuaPet Design Clinic",kind:"clinic"}});
  expect(created.statusCode).toBe(201); const organizationId=created.json().organization.organizationId;
  const member=await app!.inject({method:"POST",url:`/v1/organizations/${organizationId}/members`,headers:{...headers("platform"),"x-test-org":organizationId},payload:{userId:veterinarian,role:"veterinarian"}});
  return {organizationId,member};
}

describe("VirtuaPet Phase 2 API", () => {
  it("reports health and injected identity readiness", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/readyz" })).json().dependencies.identityVerifier).toBe("injected");
  });

  it("fails readiness closed when the repository is unavailable", async () => {
    const { MemoryPetRepository } = await import("./repository.js");
    const repository = new MemoryPetRepository();
    repository.checkHealth = async () => { throw new Error("unavailable"); };
    app = await buildApp({ repository, verifyPrincipal: verifier, environment: "test" });
    const response = await app.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "not_ready", missing: ["database"] });
  });

  it("requires an explicit browser origin in production", async () => {
    await expect(buildApp({ verifyPrincipal: verifier, environment: "production", publicApiBaseUrl: "https://api.virtuapet.com", clinicalSigningKey: "test-only-clinical-signing-key-32-bytes" })).rejects.toThrow("CORS_ALLOWED_ORIGINS");
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
    const created = await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/consents`, headers: headers("guardian"), payload: { granteeId: clinic, scopes: ["pet.health.summary.read", "pet.health.observation.write"], expiresAt: future(), purpose: "Clinic pain assessment" } });
    expect(created.statusCode).toBe(201);
    const grant = created.json();
    const revoked = await app.inject({ method: "DELETE", url: `/v1/pets/${pet.petId}/consents/${grant.grantId}`, headers: headers("guardian") });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().revokedAt).toBeTruthy();
  });

  it("requires active consent before a trained clinic assessor can record FGS", async () => {
    app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
    const pet = await createPet();
    const {organizationId,member}=await createClinic(); expect(member.statusCode).toBe(201);
    const vetHeaders={...headers("vet"),"x-test-org":organizationId};
    const payload = { assessedAt: "2026-09-14T18:00:00.000Z", assessorTrainingConfirmed: true, actionUnits: { earPosition: 1, orbitalTightening: 1, muzzleTension: 1, whiskersPosition: 1, headPosition: 0 } };
    expect((await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/feline-grimace-assessments`, headers: vetHeaders, payload })).statusCode).toBe(403);
    const grantResponse=await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/consents`, headers: headers("guardian"), payload: { granteeId: organizationId, scopes: ["pet.profile.read", "pet.health.summary.read", "pet.health.observation.write"], expiresAt: future(), purpose: "Clinic pain assessment" } });
    const scored = await app.inject({ method: "POST", url: `/v1/pets/${pet.petId}/feline-grimace-assessments`, headers: vetHeaders, payload });
    expect(scored.statusCode).toBe(201);
    expect(scored.json()).toMatchObject({ totalScore: 4, veterinaryReviewRequired: true, assessorTrainingConfirmed: true });
    await app.inject({method:"DELETE",url:`/v1/pets/${pet.petId}/consents/${grantResponse.json().grantId}`,headers:headers("guardian")});
    expect((await app.inject({method:"POST",url:`/v1/pets/${pet.petId}/feline-grimace-assessments`,headers:vetHeaders,payload})).statusCode).toBe(403);
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
    const created=await app.inject({ method: "POST", url: "/v1/regulations/evidence", headers: headers("reviewer"), payload }); expect(created.statusCode).toBe(201);
    const verified=await app.inject({method:"POST",url:`/v1/regulations/evidence/${created.json().evidenceId}/verify`,headers:headers("reviewer")}); expect(verified.json().humanVerifiedAt).toBeTruthy();
    const query=await app.inject({method:"GET",url:"/v1/regulations/evidence?countryCode=US&regionCode=CO",headers:headers("guardian")}); expect(query.json().checklistStatus).toBe("verified_evidence_available");
  });

  it("uses server-owned membership for clinic scheduling and records",async()=>{
    app=await buildApp({verifyPrincipal:verifier,environment:"test"}); const pet=await createPet(); const {organizationId,member}=await createClinic(); expect(member.statusCode).toBe(201); const vetHeaders={...headers("vet"),"x-test-org":organizationId};
    await app.inject({method:"POST",url:`/v1/pets/${pet.petId}/consents`,headers:headers("guardian"),payload:{granteeId:organizationId,scopes:["pet.profile.read"],expiresAt:future(),purpose:"Clinic pilot workflows"}});
    const appointment=await app.inject({method:"POST",url:`/v1/organizations/${organizationId}/appointments`,headers:vetHeaders,payload:{petId:pet.petId,startsAt:"2027-01-02T17:00:00.000Z",durationMinutes:30,reason:"Wellness visit"}}); expect(appointment.statusCode).toBe(201);
    expect((await app.inject({method:"GET",url:`/v1/organizations/${organizationId}/appointments`,headers:vetHeaders})).json().appointments).toHaveLength(1);
    expect((await app.inject({method:"POST",url:`/v1/organizations/${organizationId}/recalls`,headers:vetHeaders,payload:{petId:pet.petId,dueAt:"2027-06-02T17:00:00.000Z",reason:"Follow-up"}})).statusCode).toBe(201);
    expect((await app.inject({method:"POST",url:`/v1/organizations/${organizationId}/inventory`,headers:vetHeaders,payload:{sku:"VAC-001",name:"Pilot inventory item",quantityOnHand:10,reorderPoint:3}})).statusCode).toBe(201);
    expect((await app.inject({method:"POST",url:`/v1/organizations/${organizationId}/messages`,headers:vetHeaders,payload:{petId:pet.petId,subject:"Visit preparation",body:"Please bring the current medication list."}})).statusCode).toBe(201);
  });
});
