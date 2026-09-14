import { describe, expect, it } from "vitest";
import {
  clinicalModelSchema,
  consentGrantSchema,
  createFelineGrimaceAssessmentSchema,
  createImagingSeriesSchema,
  createImagingStudySchema,
  createPetSchema,
  createRegulationEvidenceSchema,
  createSurgicalPlanSchema,
  eventEnvelopeSchema,
  reviewDecisionSchema
} from "./index.js";

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

  it("validates imaging study and series contracts", () => {
    const study = createImagingStudySchema.parse({
      petId: "2a7a522c-37d0-4c9b-80ca-e4260a9b8e91",
      clinicId: "5a0a47a1-402e-437b-8082-f123402ab9d7",
      studyInstanceUid: "1.2.840.10008.1.2.4.50.12345",
      patientNameAnonymized: "CANINE-TPLO-001"
    });
    expect(study.patientNameAnonymized).toBe("CANINE-TPLO-001");

    const series = createImagingSeriesSchema.parse({
      studyId: "5a0a47a1-402e-437b-8082-f123402ab9d7",
      seriesInstanceUid: "1.2.840.10008.1.2.4.50.12345.1",
      modality: "CT",
      laterality: "L",
      bodyPartExamined: "STIFLE",
      sliceThickness: 1.0,
      pixelSpacing: [0.5, 0.5],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      rows: 512,
      columns: 512,
      sliceCount: 120,
      sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    });
    expect(series.laterality).toBe("L");
  });

  it("rejects clinical model with negative scale or invalid laterality", () => {
    const invalid = {
      modelId: "5a0a47a1-402e-437b-8082-f123402ab9d7",
      seriesId: "2a7a522c-37d0-4c9b-80ca-e4260a9b8e91",
      version: 1,
      status: "approved",
      structures: [{ structureName: "tibia", meshId: "2a7a522c-37d0-4c9b-80ca-e4260a9b8e91", vertexCount: 100, triangleCount: 180, isWatertight: true }],
      laterality: "INVALID",
      scaleFactor: -1.0,
      scaleUnits: "mm",
      coordinateSystem: "glTF_Y_UP",
      signature: "sig_valid_signature_12345678",
      entitlementScope: "clinical.twin.rehearsal",
      rollbackTargetId: null,
      approvedByUserId: "04240ca7-5f6b-497b-89f8-dd4aad574a60",
      approvedAt: "2026-09-14T18:00:00.000Z",
      rejectionReason: null,
      createdAt: "2026-09-14T18:00:00.000Z",
      updatedAt: "2026-09-14T18:00:00.000Z"
    };
    expect(clinicalModelSchema.safeParse(invalid).success).toBe(false);
  });

  it("enforces review decision rules: approval requires checklist confirmation and rejection requires reason", () => {
    expect(reviewDecisionSchema.safeParse({ decision: "approve", checklistConfirmed: false }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ decision: "approve", checklistConfirmed: true }).success).toBe(true);
    expect(reviewDecisionSchema.safeParse({ decision: "reject", checklistConfirmed: false }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ decision: "reject", reason: "Severe motion artifact on tibia", checklistConfirmed: false }).success).toBe(true);
  });

  it("validates surgical plan within TPLO constraints", () => {
    const validPlan = {
      modelId: "5a0a47a1-402e-437b-8082-f123402ab9d7",
      targetTpaDegrees: 5.0,
      measuredTpaDegrees: 28.5,
      bladeRadiusMm: 24,
      rotationDistanceMm: 8.2,
      safeMarginMm: 12.4
    };
    expect(createSurgicalPlanSchema.safeParse(validPlan).success).toBe(true);

    const invalidBlade = { ...validPlan, bladeRadiusMm: 99 };
    expect(createSurgicalPlanSchema.safeParse(invalidBlade).success).toBe(false);
  });
});
