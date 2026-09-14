import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyRequest } from "fastify";
import {
  capabilities, consentGrantSchema, createConsentGrantSchema, createFelineGrimaceAssessmentSchema,
  createPetSchema, createRegulationEvidenceSchema, felineGrimaceAssessmentSchema,
  regulationEvidenceSchema, type ConsentGrant, type FelineGrimaceAssessment, type PetProfile,
  type RegulationEvidence, uuidSchema
} from "@virtuapet/contracts";
import { verifierFromEnvironment, type Principal, type PrincipalVerifier } from "./auth.js";
import { MemoryPetRepository, type PetRepository } from "./repository.js";

declare module "fastify" { interface FastifyRequest { principal?: Principal } }

export interface AppOptions { environment?: string; repository?: PetRepository; verifyPrincipal?: PrincipalVerifier; }
const protectedPrefixes = ["/v1/pets", "/v1/regulations"];

async function ownedPet(repository: PetRepository, petId: string, principal: Principal) {
  const pet = await repository.findById(petId);
  return pet?.guardianId === principal.userId ? pet : undefined;
}

async function hasActiveClinicGrant(repository: PetRepository, petId: string, principal: Principal, scope: ConsentGrant["scopes"][number]) {
  if (!principal.organizationId) return false;
  const now = Date.now();
  return (await repository.listGrants(petId)).some(grant => grant.granteeId === principal.organizationId && grant.scopes.includes(scope) && !grant.revokedAt && Date.parse(grant.startsAt) <= now && Date.parse(grant.expiresAt) > now);
}

export async function buildApp(options: AppOptions = {}) {
  const environment = options.environment ?? process.env.VIRTUAPET_ENV ?? "development";
  const repository = options.repository ?? new MemoryPetRepository();
  const verifyPrincipal = options.verifyPrincipal ?? verifierFromEnvironment();
  const app = Fastify({ logger: environment !== "test", genReqId: () => randomUUID() });
  await app.register(helmet);
  await app.register(cors, { origin: environment === "development" });

  app.get("/healthz", async () => ({ status: "ok", service: "virtuapet-api", version: "0.2.0" }));
  app.get("/readyz", async (_request, reply) => {
    const oidcReady = Boolean(process.env.OIDC_ISSUER && process.env.OIDC_AUDIENCE && process.env.OIDC_JWKS_URL);
    const devReady = environment === "development" && Boolean(process.env.DEV_API_TOKEN);
    if (!options.verifyPrincipal && !oidcReady && !devReady) return reply.code(503).send({ status: "not_ready", missing: ["OIDC configuration"] });
    return { status: "ready", dependencies: { identityVerifier: options.verifyPrincipal ? "injected" : oidcReady ? "oidc" : "development" } };
  });
  app.get("/v1/platform/capabilities", async () => ({ generatedAt: new Date().toISOString(), capabilities }));

  app.addHook("onRequest", async (request, reply) => {
    if (!protectedPrefixes.some(prefix => request.url.startsWith(prefix))) return;
    const principal = await verifyPrincipal(request);
    if (!principal || !uuidSchema.safeParse(principal.userId).success) return reply.code(401).send({ error: "unauthorized" });
    request.principal = principal;
  });

  app.post("/v1/pets", async (request, reply) => {
    const parsed = createPetSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_pet", issues: parsed.error.issues });
    const now = new Date().toISOString();
    const profile: PetProfile = { ...parsed.data, petId: randomUUID(), guardianId: request.principal!.userId, createdAt: now, updatedAt: now, recordVersion: 1 };
    return reply.code(201).send(await repository.create(profile));
  });

  app.get<{ Params: { petId: string } }>("/v1/pets/:petId", async (request, reply) => {
    if (!uuidSchema.safeParse(request.params.petId).success) return reply.code(400).send({ error: "invalid_pet_id" });
    const pet = await ownedPet(repository, request.params.petId, request.principal!);
    return pet ?? reply.code(404).send({ error: "not_found" });
  });

  app.post<{ Params: { petId: string } }>("/v1/pets/:petId/consents", async (request, reply) => {
    if (!await ownedPet(repository, request.params.petId, request.principal!)) return reply.code(404).send({ error: "not_found" });
    const parsed = createConsentGrantSchema.safeParse({ ...(request.body as object), petId: request.params.petId });
    if (!parsed.success) return reply.code(400).send({ error: "invalid_consent", issues: parsed.error.issues });
    const grant: ConsentGrant = consentGrantSchema.parse({ ...parsed.data, grantId: randomUUID(), grantorUserId: request.principal!.userId, startsAt: new Date().toISOString(), revokedAt: null });
    return reply.code(201).send(await repository.createGrant(grant));
  });

  app.get<{ Params: { petId: string } }>("/v1/pets/:petId/consents", async (request, reply) => {
    if (!await ownedPet(repository, request.params.petId, request.principal!)) return reply.code(404).send({ error: "not_found" });
    return { grants: await repository.listGrants(request.params.petId) };
  });

  app.delete<{ Params: { petId: string; grantId: string } }>("/v1/pets/:petId/consents/:grantId", async (request, reply) => {
    if (!await ownedPet(repository, request.params.petId, request.principal!)) return reply.code(404).send({ error: "not_found" });
    const grant = (await repository.listGrants(request.params.petId)).find(item => item.grantId === request.params.grantId);
    if (!grant) return reply.code(404).send({ error: "not_found" });
    return repository.revokeGrant(grant.grantId, new Date().toISOString());
  });

  app.post<{ Params: { petId: string } }>("/v1/pets/:petId/feline-grimace-assessments", async (request, reply) => {
    const principal = request.principal!;
    if (!principal.organizationId || !principal.roles.some(role => role === "veterinarian" || role === "vet_staff")) return reply.code(403).send({ error: "clinic_role_required" });
    if (!await hasActiveClinicGrant(repository, request.params.petId, principal, "pet.health.observation.write")) return reply.code(403).send({ error: "active_consent_required" });
    const parsed = createFelineGrimaceAssessmentSchema.safeParse({ ...(request.body as object), petId: request.params.petId });
    if (!parsed.success) return reply.code(400).send({ error: "invalid_assessment", issues: parsed.error.issues });
    const totalScore = Object.values(parsed.data.actionUnits).reduce((sum, value) => sum + value, 0);
    const assessment: FelineGrimaceAssessment = felineGrimaceAssessmentSchema.parse({ ...parsed.data, assessmentId: randomUUID(), assessorUserId: principal.userId, clinicId: principal.organizationId, totalScore, veterinaryReviewRequired: totalScore >= 4, recordedAt: new Date().toISOString() });
    return reply.code(201).send(await repository.createGrimaceAssessment(assessment));
  });

  app.get<{ Params: { petId: string } }>("/v1/pets/:petId/feline-grimace-assessments", async (request, reply) => {
    const principal = request.principal!;
    const allowed = Boolean(await ownedPet(repository, request.params.petId, principal)) || await hasActiveClinicGrant(repository, request.params.petId, principal, "pet.health.summary.read");
    if (!allowed) return reply.code(404).send({ error: "not_found" });
    return { assessments: await repository.listGrimaceAssessments(request.params.petId) };
  });

  app.post("/v1/regulations/evidence", async (request, reply) => {
    const principal = request.principal!;
    if (!principal.roles.some(role => role === "regulatory_reviewer" || role === "platform_admin")) return reply.code(403).send({ error: "reviewer_role_required" });
    const parsed = createRegulationEvidenceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_evidence", issues: parsed.error.issues });
    const evidence: RegulationEvidence = regulationEvidenceSchema.parse({ ...parsed.data, evidenceId: randomUUID(), reviewerUserId: principal.userId, humanVerifiedAt: null, createdAt: new Date().toISOString() });
    return reply.code(201).send(await repository.createRegulationEvidence(evidence));
  });

  app.get<{ Querystring: { countryCode?: string; regionCode?: string } }>("/v1/regulations/evidence", async (request, reply) => {
    const countryCode = request.query.countryCode?.toUpperCase();
    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return reply.code(400).send({ error: "valid_country_code_required" });
    const evidence = await repository.listRegulationEvidence(countryCode, request.query.regionCode);
    return { evidence, checklistStatus: evidence.length ? "draft_requires_human_verification" : "unsupported" };
  });

  return app;
}
