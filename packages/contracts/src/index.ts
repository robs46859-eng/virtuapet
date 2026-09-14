import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const speciesSchema = z.enum(["dog", "cat", "bird", "reptile", "small_mammal", "other"]);

export const createPetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  species: speciesSchema,
  birthDate: z.string().date().optional(),
  microchipId: z.string().trim().min(6).max(40).optional()
}).strict();

export const petProfileSchema = createPetSchema.extend({
  petId: uuidSchema,
  guardianId: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  recordVersion: z.number().int().positive()
}).strict();

export const consentScopeSchema = z.enum([
  "pet.profile.read",
  "pet.health.summary.read",
  "pet.travel.read",
  "pet.location.current.read",
  "pet.twin.view",
  "pet.health.observation.write"
]);

export const createConsentGrantSchema = z.object({
  petId: uuidSchema,
  granteeId: uuidSchema,
  scopes: z.array(consentScopeSchema).min(1),
  expiresAt: z.string().datetime(),
  purpose: z.string().trim().min(3).max(240)
}).strict();

export const consentGrantSchema = z.object({
  grantId: uuidSchema,
  petId: uuidSchema,
  grantorUserId: uuidSchema,
  granteeId: uuidSchema,
  scopes: z.array(consentScopeSchema).min(1),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  purpose: z.string().trim().min(3).max(240)
}).strict().superRefine((grant, context) => {
  if (Date.parse(grant.expiresAt) <= Date.parse(grant.startsAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "expiresAt must be after startsAt" });
  }
});

export const eventEnvelopeSchema = z.object({
  eventId: uuidSchema,
  eventType: z.string().regex(/^virtuapet\.[a-z0-9_.]+\.v[1-9][0-9]*$/),
  occurredAt: z.string().datetime(),
  actorId: uuidSchema,
  petId: uuidSchema.optional(),
  correlationId: uuidSchema,
  schemaVersion: z.number().int().positive(),
  data: z.record(z.unknown())
}).strict();

export type CreatePet = z.infer<typeof createPetSchema>;
export type PetProfile = z.infer<typeof petProfileSchema>;
export type ConsentGrant = z.infer<typeof consentGrantSchema>;
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export const organizationRoleSchema = z.enum([
  "guardian", "caregiver", "vet_staff", "veterinarian", "clinic_admin", "regulatory_reviewer", "platform_admin"
]);

const grimaceActionUnitSchema = z.number().int().min(0).max(2);
export const createFelineGrimaceAssessmentSchema = z.object({
  petId: uuidSchema,
  assessedAt: z.string().datetime(),
  assessorTrainingConfirmed: z.literal(true),
  context: z.string().trim().max(500).optional(),
  actionUnits: z.object({
    earPosition: grimaceActionUnitSchema,
    orbitalTightening: grimaceActionUnitSchema,
    muzzleTension: grimaceActionUnitSchema,
    whiskersPosition: grimaceActionUnitSchema,
    headPosition: grimaceActionUnitSchema
  }).strict()
}).strict();

export const felineGrimaceAssessmentSchema = createFelineGrimaceAssessmentSchema.extend({
  assessmentId: uuidSchema,
  assessorUserId: uuidSchema,
  clinicId: uuidSchema,
  totalScore: z.number().int().min(0).max(10),
  veterinaryReviewRequired: z.boolean(),
  recordedAt: z.string().datetime()
}).strict();

export const createRegulationEvidenceSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z.string().trim().min(1).max(20).optional(),
  authority: z.string().trim().min(2).max(160),
  sourceUrl: z.string().url(),
  title: z.string().trim().min(3).max(240),
  retrievedAt: z.string().datetime(),
  effectiveDate: z.string().date().optional(),
  evidenceExcerpt: z.string().trim().min(10).max(1000),
  status: z.enum(["current", "unknown", "conflict"])
}).strict();

export const regulationEvidenceSchema = createRegulationEvidenceSchema.extend({
  evidenceId: uuidSchema,
  reviewerUserId: uuidSchema,
  humanVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime()
}).strict();

export type CreateConsentGrant = z.infer<typeof createConsentGrantSchema>;
export type FelineGrimaceAssessment = z.infer<typeof felineGrimaceAssessmentSchema>;
export type RegulationEvidence = z.infer<typeof regulationEvidenceSchema>;

export const capabilities = [
  { id: "pet-profile", name: "Pet Profile", status: "phase_2_pilot" },
  { id: "vetos", name: "VetOS", status: "phase_2_pilot" },
  { id: "clinical-twins", name: "Clinical Digital Twins", status: "research_and_validation" },
  { id: "surgical-rehearsal", name: "Virtual Surgical Rehearsal", status: "research_and_validation" },
  { id: "smart-vet-link", name: "Smart Global Vet Link", status: "phase_2_pilot" },
  { id: "feline-grimace", name: "Feline Grimace Scale Workflow", status: "phase_2_pilot" },
  { id: "robot", name: "Pet Assistant Robot", status: "discovery" },
  { id: "travel", name: "Pet Travel and Fleet", status: "discovery" },
  { id: "drone-logistics", name: "Drone Property Logistics", status: "research_only" },
  { id: "spatial-twins", name: "Live Spatial Twins", status: "in_development" }
] as const;
