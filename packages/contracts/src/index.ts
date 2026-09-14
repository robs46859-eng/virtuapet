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
  "pet.twin.view"
]);

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

export const capabilities = [
  { id: "pet-profile", name: "Pet Profile", status: "phase_1_foundation" },
  { id: "vetos", name: "VetOS", status: "in_development" },
  { id: "clinical-twins", name: "Clinical Digital Twins", status: "research_and_validation" },
  { id: "surgical-rehearsal", name: "Virtual Surgical Rehearsal", status: "research_and_validation" },
  { id: "smart-vet-link", name: "Smart Global Vet Link", status: "in_development" },
  { id: "feline-grimace", name: "Feline Grimace Scale Workflow", status: "in_development" },
  { id: "robot", name: "Pet Assistant Robot", status: "discovery" },
  { id: "travel", name: "Pet Travel and Fleet", status: "discovery" },
  { id: "drone-logistics", name: "Drone Property Logistics", status: "research_only" },
  { id: "spatial-twins", name: "Live Spatial Twins", status: "in_development" }
] as const;
