import { describe, expect, it } from "vitest";
import { consentGrantSchema, createFelineGrimaceAssessmentSchema, createPetSchema, createRegulationEvidenceSchema, eventEnvelopeSchema } from "./index.js";

describe("VirtuaPet contracts", () => {
  it("accepts a minimal pet", () => {
    expect(createPetSchema.parse({ name: "Milo", species: "cat" })).toEqual({ name: "Milo", species: "cat" });
  });

  it("rejects unknown pet fields", () => {
    expect(() => createPetSchema.parse({ name: "Milo", species: "cat", diagnosis: "invented" })).toThrow();
  });

  it("requires consent to expire after it starts", () => {
    const grant = {
      grantId: "f8c76410-bf0e-44f0-9658-a396b99f08be",
      petId: "2a7a522c-37d0-4c9b-80ca-e4260a9b8e91",
      grantorUserId: "04240ca7-5f6b-497b-89f8-dd4aad574a60",
      granteeId: "27138277-7967-4059-b8ab-6041b2497e5d",
      scopes: ["pet.profile.read"],
      startsAt: "2026-09-14T18:00:00.000Z",
      expiresAt: "2026-09-14T17:00:00.000Z",
      revokedAt: null,
      purpose: "Veterinary appointment"
    };
    expect(consentGrantSchema.safeParse(grant).success).toBe(false);
  });

  it("requires versioned event names", () => {
    const parsed = eventEnvelopeSchema.safeParse({
      eventId: "5a0a47a1-402e-437b-8082-f123402ab9d7",
      eventType: "pet.created",
      occurredAt: "2026-09-14T18:00:00.000Z",
      actorId: "04240ca7-5f6b-497b-89f8-dd4aad574a60",
      correlationId: "394c6b7d-d2bf-49e1-acbf-e9490b990146",
      schemaVersion: 1,
      data: {}
    });
    expect(parsed.success).toBe(false);
  });

  it("requires trained human confirmation for manual FGS", () => {
    const parsed = createFelineGrimaceAssessmentSchema.safeParse({
      petId: "2a7a522c-37d0-4c9b-80ca-e4260a9b8e91", assessedAt: "2026-09-14T18:00:00.000Z",
      assessorTrainingConfirmed: false,
      actionUnits: { earPosition: 0, orbitalTightening: 0, muzzleTension: 0, whiskersPosition: 0, headPosition: 0 }
    });
    expect(parsed.success).toBe(false);
  });

  it("requires an authoritative URL on regulation evidence", () => {
    const parsed = createRegulationEvidenceSchema.safeParse({ countryCode: "US", authority: "Authority", sourceUrl: "not-a-url", title: "Travel rule", retrievedAt: "2026-09-14T18:00:00.000Z", evidenceExcerpt: "An evidence excerpt long enough to review.", status: "current" });
    expect(parsed.success).toBe(false);
  });
});
