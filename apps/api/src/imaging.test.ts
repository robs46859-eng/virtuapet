import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "./app.js";
import type { PrincipalVerifier } from "./auth.js";
import {
  inspectFileQuarantine, deidentifyDicom, validateDicomSeries,
  computeInstanceHash, type DicomInstanceMetadata
} from "./imaging/dicom.js";
import {
  reconstructVolumeFromSeries, segmentVolume, applyClinicianCorrection,
  extractSurfaceMesh, packageGlb
} from "./imaging/pipeline.js";
import { evaluateClinicalGates, computeDice, computeHausdorff95, computeLinearError, computeAngularError } from "./imaging/qa.js";
import { runFullValidation, createHoldoutCohort } from "./imaging/validation-harness.js";

const guardian = "04240ca7-5f6b-497b-89f8-dd4aad574a60";
const veterinarian = "27138277-7967-4059-b8ab-6041b2497e5d";
const vetStaff = "11111111-2222-3333-4444-555555555555";
const clinic = "5a0a47a1-402e-437b-8082-f123402ab9d7";
const platformAdmin = "8b149ab0-04a6-4b4f-8c69-ff50613e2705";

const verifier: PrincipalVerifier = async request => {
  const kind = request.headers["x-test-principal"];
  if (kind === "guardian") return { userId: guardian, roles: ["guardian"] };
  if (kind === "vet") return { userId: veterinarian, organizationId: String(request.headers["x-test-org"] ?? clinic), roles: [] };
  if (kind === "vet-staff") return { userId: vetStaff, organizationId: String(request.headers["x-test-org"] ?? clinic), roles: [] };
  if (kind === "platform") {
    const organizationId = typeof request.headers["x-test-org"] === "string" ? request.headers["x-test-org"] : undefined;
    return { userId: platformAdmin, ...(organizationId ? { organizationId } : {}), roles: ["platform_admin"] };
  }
  return undefined;
};

let app: Awaited<ReturnType<typeof buildApp>> | undefined;
const headers = (kind: string, orgId?: string) => ({
  "x-test-principal": kind,
  ...(orgId ? { "x-test-org": orgId } : {})
});
const future = () => new Date(Date.now() + 3_600_000).toISOString();

afterEach(async () => { await app?.close(); app = undefined; });

async function setupClinicAndPet() {
  app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
  // Create clinic
  const clinicRes = await app.inject({
    method: "POST", url: "/v1/organizations",
    headers: headers("platform"),
    payload: { name: "Summit Veterinary Surgery", kind: "clinic" }
  });
  const orgId = clinicRes.json().organization.organizationId;

  // Add veterinarian and vet_staff members
  await app.inject({
    method: "POST", url: `/v1/organizations/${orgId}/members`,
    headers: { ...headers("platform"), "x-test-org": orgId },
    payload: { userId: veterinarian, role: "veterinarian" }
  });
  await app.inject({
    method: "POST", url: `/v1/organizations/${orgId}/members`,
    headers: { ...headers("platform"), "x-test-org": orgId },
    payload: { userId: vetStaff, role: "vet_staff" }
  });

  // Create pet
  const petRes = await app.inject({
    method: "POST", url: "/v1/pets",
    headers: headers("guardian"),
    payload: { name: "Zeus", species: "dog" }
  });
  const pet = petRes.json();

  // Grant imaging permissions to clinic
  await app.inject({
    method: "POST", url: `/v1/pets/${pet.petId}/consents`,
    headers: headers("guardian"),
    payload: {
      granteeId: orgId,
      scopes: ["pet.profile.read", "pet.imaging.read", "pet.imaging.write", "pet.imaging.rehearse"],
      expiresAt: future(),
      purpose: "TPLO Clinical Twin and Rehearsal"
    }
  });

  return { orgId, pet };
}

describe("Phase 3 Clinical Twin Validation Suite", () => {
  describe("Security, Quarantine, & Ingestion Integrity", () => {
    it("rejects malicious executable payloads and path traversal", () => {
      // Windows PE binary (MZ header)
      const peBuffer = Buffer.concat([Buffer.from([0x4D, 0x5A]), Buffer.alloc(200)]);
      expect(inspectFileQuarantine(peBuffer, "scan.dcm").isSafe).toBe(false);

      // Linux ELF binary
      const elfBuffer = Buffer.concat([Buffer.from([0x7F, 0x45, 0x4C, 0x46]), Buffer.alloc(200)]);
      expect(inspectFileQuarantine(elfBuffer, "scan.dcm").isSafe).toBe(false);

      // Mach-O binary
      const machoBuffer = Buffer.concat([Buffer.from([0xFE, 0xED, 0xFA, 0xCF]), Buffer.alloc(200)]);
      expect(inspectFileQuarantine(machoBuffer, "scan.dcm").isSafe).toBe(false);

      // Path traversal
      const dicmBuffer = Buffer.alloc(140);
      dicmBuffer.write("DICM", 128, "ascii");
      expect(inspectFileQuarantine(dicmBuffer, "../../etc/passwd").isSafe).toBe(false);

      // Oversized file (>100MB)
      const hugeBuffer = Buffer.alloc(101 * 1024 * 1024);
      expect(inspectFileQuarantine(hugeBuffer, "huge.dcm").isSafe).toBe(false);

      // Valid DICOM Part 10 preamble
      expect(inspectFileQuarantine(dicmBuffer, "clean_stifle_001.dcm").isSafe).toBe(true);
    });

    it("de-identifies DICOM while preserving clinical geometry", () => {
      const metadata: DicomInstanceMetadata = {
        sopInstanceUid: "1.2.840.10008.1.1",
        patientId: "OWNER_DOE_JOHN_PET_ZEUS",
        patientName: "Zeus Doe",
        studyInstanceUid: "1.2.3.4.5",
        seriesInstanceUid: "1.2.3.4.5.1",
        modality: "CT",
        laterality: "L",
        sliceThickness: 1.0,
        pixelSpacing: [0.5, 0.5],
        imageOrientationPatient: [1, 0, 0, 0, 1, 0],
        imagePositionPatient: [0, 0, 10],
        rows: 512,
        columns: 512,
        instanceNumber: 1
      };

      const anon = deidentifyDicom(metadata);
      expect(anon.patientId).toMatch(/^ANON-CANINE-[0-9A-F]{16}$/);
      expect(anon.patientName).toContain("ANONYMIZED^CANINE^");
      expect(anon.sliceThickness).toBe(1.0);
      expect(anon.pixelSpacing).toEqual([0.5, 0.5]);
      expect(anon.laterality).toBe("L");
    });

    it("detects and rejects non-contiguous slices and patient/laterality mismatches", () => {
      const baseInstance: DicomInstanceMetadata = {
        sopInstanceUid: "1.2.3.4",
        patientId: "CANINE-001",
        studyInstanceUid: "STUDY-1",
        seriesInstanceUid: "SERIES-1",
        modality: "CT",
        laterality: "L",
        sliceThickness: 1.0,
        pixelSpacing: [0.5, 0.5],
        imageOrientationPatient: [1, 0, 0, 0, 1, 0],
        imagePositionPatient: [0, 0, 0],
        rows: 512,
        columns: 512,
        instanceNumber: 1
      };

      // Create contiguous series of 10 slices
      const validInstances: DicomInstanceMetadata[] = Array.from({ length: 10 }, (_, idx) => ({
        ...baseInstance,
        sopInstanceUid: `1.2.3.4.${idx}`,
        imagePositionPatient: [0, 0, idx * 1.0],
        instanceNumber: idx + 1
      }));

      expect(validateDicomSeries(validInstances, "L").valid).toBe(true);

      // Corrupt slice 5 with a gap (e.g. missing slice, gap = 2.0 mm instead of 1.0 mm)
      const gappedInstances = validInstances.map((inst, idx) => ({
        ...inst,
        imagePositionPatient: [0, 0, idx >= 5 ? (idx + 1) * 1.0 : idx * 1.0] as [number, number, number]
      }));
      const gapRes = validateDicomSeries(gappedInstances, "L");
      expect(gapRes.valid).toBe(false);
      expect(gapRes.failures.some(f => f.field === "sliceSpacing")).toBe(true);

      // Corrupt slice 3 with different patient ID
      const mixedPatient = validInstances.map((inst, idx) => idx === 3 ? { ...inst, patientId: "ANOTHER_PATIENT" } : inst);
      const patRes = validateDicomSeries(mixedPatient, "L");
      expect(patRes.valid).toBe(false);
      expect(patRes.failures.some(f => f.field === "patientId")).toBe(true);

      // Corrupt slice 4 with different laterality
      const mixedLaterality = validInstances.map((inst, idx) => idx === 4 ? { ...inst, laterality: "R" as const } : inst);
      const latRes = validateDicomSeries(mixedLaterality, "L");
      expect(latRes.valid).toBe(false);
      expect(latRes.failures.some(f => f.field === "laterality")).toBe(true);
    });
  });

  describe("Imaging Pipeline & Clinical Review Endpoints", () => {
    it("runs complete ingestion, volume reconstruction, segmentation, and mesh extraction", async () => {
      const { orgId, pet } = await setupClinicAndPet();
      const vetHeaders = headers("vet", orgId);

      // Create study
      const studyRes = await app!.inject({
        method: "POST", url: "/v1/imaging/studies",
        headers: vetHeaders,
        payload: {
          petId: pet.petId,
          clinicId: orgId,
          studyInstanceUid: "1.2.840.TPLO.2026.1",
          patientNameAnonymized: "ZEUS-CANINE"
        }
      });
      expect(studyRes.statusCode).toBe(201);
      const study = studyRes.json();

      // Ingest series
      const seriesRes = await app!.inject({
        method: "POST", url: `/v1/imaging/studies/${study.studyId}/series`,
        headers: vetHeaders,
        payload: {
          studyId: study.studyId,
          seriesInstanceUid: "1.2.840.TPLO.2026.1.1",
          modality: "CT",
          laterality: "L",
          bodyPartExamined: "STIFLE",
          sliceThickness: 1.0,
          pixelSpacing: [0.5, 0.5],
          imageOrientationPatient: [1, 0, 0, 0, 1, 0],
          rows: 512,
          columns: 512,
          sliceCount: 60,
          sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        }
      });
      expect(seriesRes.statusCode).toBe(201);
      const series = seriesRes.json();

      // Reconstruct volume
      const volRes = await app!.inject({
        method: "POST", url: `/v1/imaging/series/${series.seriesId}/reconstruct`,
        headers: vetHeaders
      });
      expect(volRes.statusCode).toBe(201);
      const volume = volRes.json();
      expect(volume.coordinateFrame).toBe("DICOM_LPS");
      expect(volume.units).toBe("HU");

      // Multi-label segmentation
      const segRes = await app!.inject({
        method: "POST", url: `/v1/imaging/volumes/${volume.volumeId}/segment`,
        headers: vetHeaders
      });
      expect(segRes.statusCode).toBe(201);
      const segmentation = segRes.json();
      expect(segmentation.structures).toHaveLength(4);

      // Clinician correction
      const corrRes = await app!.inject({
        method: "POST", url: `/v1/imaging/segmentations/${segmentation.segmentationId}/correct`,
        headers: vetHeaders,
        payload: {
          targetId: segmentation.segmentationId,
          targetType: "segmentation",
          notes: "Refined tibial plateau caudal border contour",
          diffSummary: "Adjusted 12 boundary voxels"
        }
      });
      expect(corrRes.statusCode).toBe(201);
      const correctedSeg = corrRes.json();
      expect(correctedSeg.version).toBe(2);
      expect(correctedSeg.parentSegmentationId).toBe(segmentation.segmentationId);

      // Mesh extraction & repair
      const meshRes = await app!.inject({
        method: "POST", url: `/v1/imaging/segmentations/${correctedSeg.segmentationId}/meshes`,
        headers: vetHeaders
      });
      expect(meshRes.statusCode).toBe(201);
      const meshes = meshRes.json().meshes;
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes[0].isWatertight).toBe(true);

      // Create model
      const modelRes = await app!.inject({
        method: "POST", url: `/v1/imaging/series/${series.seriesId}/models`,
        headers: vetHeaders
      });
      expect(modelRes.statusCode).toBe(201);
      const model = modelRes.json();
      expect(model.status).toBe("clinician_review");
      expect(model.signature).toBeTruthy();
    });

    it("enforces strict veterinarian approval gate before rehearsal", async () => {
      const { orgId, pet } = await setupClinicAndPet();
      const vetHeaders = headers("vet", orgId);
      const staffHeaders = headers("vet-staff", orgId);

      // Create study, series, volume, segmentation, meshes, model
      const study = (await app!.inject({ method: "POST", url: "/v1/imaging/studies", headers: vetHeaders, payload: { petId: pet.petId, clinicId: orgId, studyInstanceUid: "1.2.TPLO.TEST.1", patientNameAnonymized: "ZEUS" } })).json();
      const series = (await app!.inject({ method: "POST", url: `/v1/imaging/studies/${study.studyId}/series`, headers: vetHeaders, payload: { studyId: study.studyId, seriesInstanceUid: "1.2.TPLO.TEST.1.1", modality: "CT", laterality: "L", bodyPartExamined: "STIFLE", sliceThickness: 1.0, pixelSpacing: [0.5, 0.5], imageOrientationPatient: [1, 0, 0, 0, 1, 0], rows: 512, columns: 512, sliceCount: 60, sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" } })).json();
      const volume = (await app!.inject({ method: "POST", url: `/v1/imaging/series/${series.seriesId}/reconstruct`, headers: vetHeaders })).json();
      const seg = (await app!.inject({ method: "POST", url: `/v1/imaging/volumes/${volume.volumeId}/segment`, headers: vetHeaders })).json();
      await app!.inject({ method: "POST", url: `/v1/imaging/segmentations/${seg.segmentationId}/meshes`, headers: vetHeaders });
      const model = (await app!.inject({ method: "POST", url: `/v1/imaging/series/${series.seriesId}/models`, headers: vetHeaders })).json();

      // Create TPLO surgical plan
      const planRes = await app!.inject({
        method: "POST", url: `/v1/imaging/models/${model.modelId}/plans`,
        headers: vetHeaders,
        payload: {
          modelId: model.modelId,
          targetTpaDegrees: 5.0,
          measuredTpaDegrees: 28.0,
          bladeRadiusMm: 24,
          rotationDistanceMm: 8.0,
          safeMarginMm: 11.5
        }
      });
      expect(planRes.statusCode).toBe(201);
      const plan = planRes.json();

      // GATE ENFORCEMENT: Rehearsal session MUST FAIL if model is not approved
      const unapprovedRehearsal = await app!.inject({
        method: "POST", url: `/v1/imaging/plans/${plan.planId}/rehearsal`,
        headers: vetHeaders,
        payload: { planId: plan.planId, deviceProfile: "AppleVisionPro_visionOS2" }
      });
      expect(unapprovedRehearsal.statusCode).toBe(403);
      expect(unapprovedRehearsal.json().error).toBe("rehearsal_locked_approval_required");

      // Non-veterinarian (vet_staff) CANNOT approve the model
      const staffApproval = await app!.inject({
        method: "POST", url: `/v1/imaging/models/${model.modelId}/review`,
        headers: staffHeaders,
        payload: { decision: "approve", checklistConfirmed: true }
      });
      expect(staffApproval.statusCode).toBe(403);
      expect(staffApproval.json().error).toBe("veterinarian_role_required_for_approval");

      // Veterinarian approves with checklist confirmation
      const vetApproval = await app!.inject({
        method: "POST", url: `/v1/imaging/models/${model.modelId}/review`,
        headers: vetHeaders,
        payload: { decision: "approve", checklistConfirmed: true }
      });
      expect(vetApproval.statusCode).toBe(200);
      expect(vetApproval.json().status).toBe("approved");

      // NOW rehearsal session succeeds!
      const approvedRehearsal = await app!.inject({
        method: "POST", url: `/v1/imaging/plans/${plan.planId}/rehearsal`,
        headers: vetHeaders,
        payload: { planId: plan.planId, deviceProfile: "AppleVisionPro_visionOS2" }
      });
      expect(approvedRehearsal.statusCode).toBe(201);
      const session = approvedRehearsal.json();
      expect(session.status).toBe("in_progress");

      // Complete rehearsal
      const completeRes = await app!.inject({
        method: "POST", url: `/v1/imaging/rehearsal/${session.sessionId}/complete`,
        headers: vetHeaders,
        payload: {
          tasksCompleted: ["align_blade", "radial_cut", "rotate_segment", "check_margin"],
          unassistedCompletion: true,
          durationSeconds: 320
        }
      });
      expect(completeRes.statusCode).toBe(200);
      expect(completeRes.json().status).toBe("completed");
      expect(completeRes.json().unassistedCompletion).toBe(true);
    });

    it("verifies GibiWorld manifest delivery fails closed on patient/laterality mismatch or unapproved model", async () => {
      const { orgId, pet } = await setupClinicAndPet();
      const vetHeaders = headers("vet", orgId);

      const study = (await app!.inject({ method: "POST", url: "/v1/imaging/studies", headers: vetHeaders, payload: { petId: pet.petId, clinicId: orgId, studyInstanceUid: "1.2.TPLO.GIBI.1", patientNameAnonymized: "ZEUS" } })).json();
      const series = (await app!.inject({ method: "POST", url: `/v1/imaging/studies/${study.studyId}/series`, headers: vetHeaders, payload: { studyId: study.studyId, seriesInstanceUid: "1.2.TPLO.GIBI.1.1", modality: "CT", laterality: "L", bodyPartExamined: "STIFLE", sliceThickness: 1.0, pixelSpacing: [0.5, 0.5], imageOrientationPatient: [1, 0, 0, 0, 1, 0], rows: 512, columns: 512, sliceCount: 60, sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" } })).json();
      const volume = (await app!.inject({ method: "POST", url: `/v1/imaging/series/${series.seriesId}/reconstruct`, headers: vetHeaders })).json();
      const seg = (await app!.inject({ method: "POST", url: `/v1/imaging/volumes/${volume.volumeId}/segment`, headers: vetHeaders })).json();
      await app!.inject({ method: "POST", url: `/v1/imaging/segmentations/${seg.segmentationId}/meshes`, headers: vetHeaders });
      const model = (await app!.inject({ method: "POST", url: `/v1/imaging/series/${series.seriesId}/models`, headers: vetHeaders })).json();

      // Try reading manifest before approval -> FAILS
      const unapprovedManifest = await app!.inject({
        method: "GET", url: `/v1/imaging/models/${model.modelId}/gibiworld-manifest`,
        headers: vetHeaders
      });
      expect(unapprovedManifest.statusCode).toBe(403);

      // Approve model
      await app!.inject({ method: "POST", url: `/v1/imaging/models/${model.modelId}/review`, headers: vetHeaders, payload: { decision: "approve", checklistConfirmed: true } });

      // Request with wrong laterality (R instead of L) -> FAILS
      const latMismatch = await app!.inject({
        method: "GET", url: `/v1/imaging/models/${model.modelId}/gibiworld-manifest?laterality=R`,
        headers: vetHeaders
      });
      expect(latMismatch.statusCode).toBe(403);

      // Request with wrong pet ID -> FAILS
      const petMismatch = await app!.inject({
        method: "GET", url: `/v1/imaging/models/${model.modelId}/gibiworld-manifest?petId=${randomUUID()}`,
        headers: vetHeaders
      });
      expect(petMismatch.statusCode).toBe(403);

      // Request with unsupported device profile -> FAILS
      const unsupportedDev = await app!.inject({
        method: "GET", url: `/v1/imaging/models/${model.modelId}/gibiworld-manifest?deviceProfile=GoogleCardboard`,
        headers: vetHeaders
      });
      expect(unsupportedDev.statusCode).toBe(403);

      // Valid manifest request -> SUCCEEDS
      const validManifest = await app!.inject({
        method: "GET", url: `/v1/imaging/models/${model.modelId}/gibiworld-manifest?deviceProfile=AppleVisionPro_visionOS2`,
        headers: vetHeaders
      });
      expect(validManifest.statusCode).toBe(200);
      const manifest = validManifest.json();
      expect(manifest.status).toBe("approved_ready_for_rehearsal");
      expect(manifest.physicalScale).toBe(1.0);
      expect(manifest.coordinateSystem).toBe("glTF_Y_UP");
    });
  });

  describe("Validation Harness & Subgroup Evaluation", () => {
    it("evaluates 50 synthetic calculation fixtures without hidden subgroup failure", () => {
      const cohort = createHoldoutCohort();
      expect(cohort).toHaveLength(50);

      const report = runFullValidation(cohort);
      expect(report.evidenceClass).toBe("synthetic_fixture");
      expect(report.totalCases).toBe(50);
      expect(report.independentSitesCount).toBe(3);
      expect(report.passedAllGates).toBe(true);
      expect(report.noHiddenSubgroupFailures).toBe(true);

      // Verify minimum acceptance thresholds
      expect(report.aggregateMetrics.overallLinearPassRatePct).toBeGreaterThanOrEqual(95.0);
      expect(report.aggregateMetrics.overallTpaPassRatePct).toBeGreaterThanOrEqual(95.0);
      expect(report.aggregateMetrics.overallHd95PassRatePct).toBeGreaterThanOrEqual(95.0);
      expect(report.aggregateMetrics.avgDiceTibia).toBeGreaterThanOrEqual(0.92);
      expect(report.aggregateMetrics.avgDiceFemur).toBeGreaterThanOrEqual(0.90);
      expect(report.aggregateMetrics.avgDicePatella).toBeGreaterThanOrEqual(0.88);
      expect(report.aggregateMetrics.overallRehearsalCompletionPct).toBeGreaterThanOrEqual(90.0);
      expect(report.aggregateMetrics.medianSusScore).toBeGreaterThanOrEqual(80.0);
      expect(report.aggregateMetrics.patientMismatchCount).toBe(0);
      expect(report.aggregateMetrics.lateralityMismatchCount).toBe(0);

      // Check each subgroup individually
      for (const group of report.subgroups.bodySize) {
        expect(group.passedAllGates).toBe(true);
        expect(group.linearPassRatePct).toBeGreaterThanOrEqual(95.0);
      }
      for (const group of report.subgroups.scannerVendor) {
        expect(group.passedAllGates).toBe(true);
      }
      for (const group of report.subgroups.protocol) {
        expect(group.passedAllGates).toBe(true);
      }
      for (const group of report.subgroups.pathology) {
        expect(group.passedAllGates).toBe(true);
      }
    });

    it("triggers validation run via API endpoint", async () => {
      app = await buildApp({ verifyPrincipal: verifier, environment: "test" });
      const res = await app.inject({
        method: "POST", url: "/v1/imaging/validation/run", headers: headers("platform")
      });
      expect(res.statusCode).toBe(200);
      const report = res.json();
      expect(report.evidenceClass).toBe("synthetic_fixture");
      expect(report.passedAllGates).toBe(true);
      expect(report.aggregateMetrics.overallTpaPassRatePct).toBeGreaterThanOrEqual(95.0);
    });
  });
});
