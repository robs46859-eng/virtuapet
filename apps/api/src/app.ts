import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyRequest } from "fastify";
import {
  appointmentSchema, capabilities, clinicMessageSchema, consentGrantSchema, createAppointmentSchema,
  createClinicMessageSchema, createConsentGrantSchema, createFelineGrimaceAssessmentSchema,
  createInventoryItemSchema, createMembershipSchema, createOrganizationSchema, createPetSchema,
  createRecallSchema, createRegulationEvidenceSchema, felineGrimaceAssessmentSchema,
  inventoryItemSchema, membershipSchema, organizationSchema, recallSchema, regulationEvidenceSchema,
  type Appointment, type ClinicMessage, type ConsentGrant, type FelineGrimaceAssessment,
  type InventoryItem, type Membership, type Organization, type PetProfile, type Recall,
  type RegulationEvidence, uuidSchema
} from "@virtuapet/contracts";
import { verifierFromEnvironment, type Principal, type PrincipalVerifier } from "./auth.js";
import { MemoryPetRepository, type PetRepository } from "./repository.js";
import { registerImagingRoutes } from "./imaging/routes.js";
import { integrationServicesFromEnvironment, registerIntegrationRoutes, type IntegrationServices } from "./integrations/routes.js";

declare module "fastify" { interface FastifyRequest { principal?: Principal } }

export interface AppOptions {
  environment?: string;
  repository?: PetRepository;
  verifyPrincipal?: PrincipalVerifier;
  clinicalSigningKey?: string;
  publicApiBaseUrl?: string;
  corsAllowedOrigins?: string[];
  integrations?: IntegrationServices;
}
const protectedPrefixes = ["/v1/pets", "/v1/regulations", "/v1/organizations", "/v1/imaging", "/v1/integrations"];

async function ownedPet(repository: PetRepository, petId: string, principal: Principal) {
  const pet = await repository.findById(petId);
  return pet?.guardianId === principal.userId ? pet : undefined;
}

async function hasActiveClinicGrant(repository: PetRepository, petId: string, principal: Principal, scope: ConsentGrant["scopes"][number]) {
  if (!principal.organizationId) return false;
  const now = Date.now();
  return (await repository.listGrants(petId)).some(grant => grant.granteeId === principal.organizationId && grant.scopes.includes(scope) && !grant.revokedAt && Date.parse(grant.startsAt) <= now && Date.parse(grant.expiresAt) > now);
}

async function clinicMembership(repository: PetRepository, principal: Principal) {
  return principal.organizationId ? repository.findMembership(principal.organizationId, principal.userId) : undefined;
}

export async function buildApp(options: AppOptions = {}) {
  const environment = options.environment ?? process.env.VIRTUAPET_ENV ?? "development";
  const repository = options.repository ?? new MemoryPetRepository(environment);
  const verifyPrincipal = options.verifyPrincipal ?? verifierFromEnvironment();
  const clinicalSigningKey = options.clinicalSigningKey ?? process.env.CLINICAL_TWIN_SIGNING_KEY ?? (environment === "test" ? "test-only-clinical-signing-key-32-bytes" : undefined);
  if (!clinicalSigningKey) throw new Error("CLINICAL_TWIN_SIGNING_KEY is required outside tests");
  const publicApiBaseUrl = options.publicApiBaseUrl ?? process.env.PUBLIC_API_BASE_URL ?? (environment === "production" ? undefined : "http://127.0.0.1:8080");
  if (!publicApiBaseUrl) throw new Error("PUBLIC_API_BASE_URL is required in production");
  const corsAllowedOrigins = options.corsAllowedOrigins ?? (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (environment === "production" && corsAllowedOrigins.length === 0) throw new Error("CORS_ALLOWED_ORIGINS is required in production");
  const app = Fastify({ logger: environment !== "test", genReqId: () => randomUUID() });
  await app.register(helmet);
  await app.register(cors, { origin: environment === "development" ? true : corsAllowedOrigins });
  app.addHook("onClose", async () => repository.close());

  app.get("/healthz", async () => ({ status: "ok", service: "virtuapet-api", version: "0.3.0" }));
  app.get("/readyz", async (_request, reply) => {
    const oidcReady = Boolean(process.env.OIDC_ISSUER && process.env.OIDC_AUDIENCE && process.env.OIDC_JWKS_URL);
    const devReady = environment === "development" && Boolean(process.env.DEV_API_TOKEN);
    if (!options.verifyPrincipal && !oidcReady && !devReady) return reply.code(503).send({ status: "not_ready", missing: ["OIDC configuration"] });
    try {
      await repository.checkHealth();
    } catch {
      return reply.code(503).send({ status: "not_ready", missing: ["database"] });
    }
    return { status: "ready", dependencies: { identityVerifier: options.verifyPrincipal ? "injected" : oidcReady ? "oidc" : "development", database: "available" } };
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
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) return reply.code(403).send({ error: "clinic_role_required" });
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

  app.post<{ Params: { evidenceId: string } }>("/v1/regulations/evidence/:evidenceId/verify", async (request, reply) => {
    const principal = request.principal!;
    if (!principal.roles.some(role => role === "regulatory_reviewer" || role === "platform_admin")) return reply.code(403).send({ error: "reviewer_role_required" });
    const evidence = await repository.verifyRegulationEvidence(request.params.evidenceId, new Date().toISOString());
    return evidence ?? reply.code(404).send({ error: "not_found" });
  });

  app.get<{ Querystring: { countryCode?: string; regionCode?: string } }>("/v1/regulations/evidence", async (request, reply) => {
    const countryCode = request.query.countryCode?.toUpperCase();
    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) return reply.code(400).send({ error: "valid_country_code_required" });
    const evidence = await repository.listRegulationEvidence(countryCode, request.query.regionCode);
    return { evidence, checklistStatus: evidence.length === 0 ? "unsupported" : evidence.some(item => !item.humanVerifiedAt || item.status !== "current") ? "draft_requires_human_verification" : "verified_evidence_available" };
  });

  app.post("/v1/organizations", async (request, reply) => {
    const principal = request.principal!;
    if (!principal.roles.includes("platform_admin")) return reply.code(403).send({ error: "platform_admin_required" });
    const parsed=createOrganizationSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:"invalid_organization",issues:parsed.error.issues});
    const createdAt=new Date().toISOString(); const organization:Organization=organizationSchema.parse({...parsed.data,organizationId:randomUUID(),createdAt}); await repository.createOrganization(organization);
    const membership:Membership=membershipSchema.parse({membershipId:randomUUID(),organizationId:organization.organizationId,userId:principal.userId,role:organization.kind==="clinic"?"clinic_admin":"guardian",status:"active",createdAt,revokedAt:null}); await repository.createMembership(membership);
    return reply.code(201).send({organization,membership});
  });

  app.post<{Params:{organizationId:string}}>("/v1/organizations/:organizationId/members",async(request,reply)=>{
    const principal=request.principal!; const admin=await repository.findMembership(request.params.organizationId,principal.userId); if(admin?.role!=="clinic_admin") return reply.code(403).send({error:"clinic_admin_required"});
    const parsed=createMembershipSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:"invalid_membership",issues:parsed.error.issues});
    const membership:Membership=membershipSchema.parse({...parsed.data,membershipId:randomUUID(),organizationId:request.params.organizationId,status:"active",createdAt:new Date().toISOString(),revokedAt:null}); return reply.code(201).send(await repository.createMembership(membership));
  });

  app.post<{Params:{organizationId:string}}>("/v1/organizations/:organizationId/appointments",async(request,reply)=>{
    const principal=request.principal!; const member=await repository.findMembership(request.params.organizationId,principal.userId); if(!member) return reply.code(403).send({error:"clinic_membership_required"});
    const parsed=createAppointmentSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:"invalid_appointment",issues:parsed.error.issues});
    if(!await hasActiveClinicGrant(repository,parsed.data.petId,{...principal,organizationId:request.params.organizationId},"pet.profile.read")) return reply.code(403).send({error:"active_consent_required"});
    const item:Appointment=appointmentSchema.parse({...parsed.data,appointmentId:randomUUID(),clinicId:request.params.organizationId,status:"scheduled",createdByUserId:principal.userId,createdAt:new Date().toISOString()}); return reply.code(201).send(await repository.createAppointment(item));
  });

  app.get<{Params:{organizationId:string}}>("/v1/organizations/:organizationId/appointments",async(request,reply)=>{ const member=await repository.findMembership(request.params.organizationId,request.principal!.userId); if(!member)return reply.code(403).send({error:"clinic_membership_required"}); return {appointments:await repository.listAppointments(request.params.organizationId)}; });

  app.post<{Params:{organizationId:string}}>("/v1/organizations/:organizationId/recalls",async(request,reply)=>{ const principal=request.principal!; const member=await repository.findMembership(request.params.organizationId,principal.userId); if(!member)return reply.code(403).send({error:"clinic_membership_required"}); const parsed=createRecallSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"invalid_recall",issues:parsed.error.issues}); const item:Recall=recallSchema.parse({...parsed.data,recallId:randomUUID(),clinicId:request.params.organizationId,status:"open",createdByUserId:principal.userId,createdAt:new Date().toISOString()}); return reply.code(201).send(await repository.createRecall(item)); });
  app.post<{Params:{organizationId:string}}>("/v1/organizations/:organizationId/inventory",async(request,reply)=>{ const principal=request.principal!; const member=await repository.findMembership(request.params.organizationId,principal.userId); if(!member||!["clinic_admin","vet_staff","veterinarian"].includes(member.role))return reply.code(403).send({error:"clinic_membership_required"}); const parsed=createInventoryItemSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"invalid_inventory",issues:parsed.error.issues}); const item:InventoryItem=inventoryItemSchema.parse({...parsed.data,inventoryItemId:randomUUID(),clinicId:request.params.organizationId,updatedByUserId:principal.userId,updatedAt:new Date().toISOString()}); return reply.code(201).send(await repository.createInventoryItem(item)); });
  app.post<{Params:{organizationId:string}}>("/v1/organizations/:organizationId/messages",async(request,reply)=>{ const principal=request.principal!; const member=await repository.findMembership(request.params.organizationId,principal.userId); if(!member)return reply.code(403).send({error:"clinic_membership_required"}); const parsed=createClinicMessageSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"invalid_message",issues:parsed.error.issues}); if(!await hasActiveClinicGrant(repository,parsed.data.petId,{...principal,organizationId:request.params.organizationId},"pet.profile.read"))return reply.code(403).send({error:"active_consent_required"}); const item:ClinicMessage=clinicMessageSchema.parse({...parsed.data,messageId:randomUUID(),clinicId:request.params.organizationId,authorUserId:principal.userId,createdAt:new Date().toISOString()}); return reply.code(201).send(await repository.createClinicMessage(item)); });

  await registerImagingRoutes(app, repository, { signingKey: clinicalSigningKey, publicApiBaseUrl });
  await registerIntegrationRoutes(app, repository, options.integrations ?? integrationServicesFromEnvironment());
  return app;
}
