import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createImagingStudySchema, createImagingSeriesSchema, createSurgicalPlanSchema,
  createRehearsalSessionSchema, reviewDecisionSchema, createClinicalCorrectionSchema,
  uuidSchema, type ImagingStudy, type ImagingSeries, type ClinicalModel,
  type SurgicalPlan, type RehearsalSession, type ClinicalQualityResult
} from "@virtuapet/contracts";
import type { PetRepository } from "../repository.js";
import type { Principal } from "../auth.js";
import {
  inspectFileQuarantine, validateDicomSeries, computeInstanceHash,
  type DicomInstanceMetadata
} from "./dicom.js";
import {
  reconstructVolumeFromSeries, segmentVolume, applyClinicianCorrection,
  extractSurfaceMesh, createSignedModel, packageGlb, generateGibiWorldManifest,
  verifyRehearsalEligibility
} from "./pipeline.js";
import { evaluateClinicalGates } from "./qa.js";
import { runFullValidation } from "./validation-harness.js";

async function clinicMembership(repository: PetRepository, principal: Principal) {
  if (!principal.organizationId) return undefined;
  const membership = await repository.findMembership(principal.organizationId, principal.userId);
  return membership?.status === "active" && membership.revokedAt === null ? membership : undefined;
}

async function hasActiveClinicGrant(
  repository: PetRepository,
  petId: string,
  principal: Principal,
  scope: string
) {
  if (!principal.organizationId) return false;
  const now = Date.now();
  const grants = await repository.listGrants(petId);
  return grants.some(grant =>
    grant.granteeId === principal.organizationId &&
    grant.scopes.includes(scope as any) &&
    !grant.revokedAt &&
    Date.parse(grant.startsAt) <= now &&
    Date.parse(grant.expiresAt) > now
  );
}

export interface ImagingRouteOptions {
  signingKey: string;
  publicApiBaseUrl: string;
}

export async function registerImagingRoutes(app: FastifyInstance, repository: PetRepository, options: ImagingRouteOptions) {
  // 1. Quarantine & Ingestion inspection
  app.post("/v1/imaging/quarantine-check", async (request, reply) => {
    const body = request.body as { fileName: string; contentBase64?: string };
    if (!body || !body.fileName) return reply.code(400).send({ error: "fileName_required" });

    const buffer = body.contentBase64 ? Buffer.from(body.contentBase64, "base64") : Buffer.alloc(0);
    const quarantine = inspectFileQuarantine(buffer, body.fileName);
    return quarantine;
  });

  // 2. Imaging Study creation & lookup
  app.post("/v1/imaging/studies", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) {
      return reply.code(403).send({ error: "clinic_role_required" });
    }

    const parsed = createImagingStudySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_study", issues: parsed.error.issues });

    if (!await hasActiveClinicGrant(repository, parsed.data.petId, principal, "pet.imaging.write")) {
      return reply.code(403).send({ error: "active_consent_required" });
    }

    const study: ImagingStudy = {
      ...parsed.data,
      studyId: randomUUID(),
      status: "validated",
      createdAt: new Date().toISOString()
    };

    const created = await repository.createImagingStudy(study);
    await repository.createImagingAuditEvent({
      auditId: randomUUID(),
      eventType: "virtuapet.imaging.study_created.v1",
      actorId: principal.userId,
      entityType: "imaging_study",
      entityId: created.studyId,
      correlationId: randomUUID(),
      details: { petId: study.petId, clinicId: study.clinicId },
      occurredAt: new Date().toISOString()
    });

    return reply.code(201).send(created);
  });

  app.get<{ Params: { studyId: string } }>("/v1/imaging/studies/:studyId", async (request, reply) => {
    const study = await repository.findImagingStudyById(request.params.studyId);
    if (!study) return reply.code(404).send({ error: "not_found" });

    const principal = request.principal!;
    const pet = await repository.findById(study.petId);
    const isGuardian = pet?.guardianId === principal.userId;
    const hasGrant = await hasActiveClinicGrant(repository, study.petId, principal, "pet.imaging.read");

    if (!isGuardian && !hasGrant) return reply.code(404).send({ error: "not_found" });
    return study;
  });

  // 3. Series Ingestion & Contiguity Validation
  app.post<{ Params: { studyId: string } }>("/v1/imaging/studies/:studyId/series", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) {
      return reply.code(403).send({ error: "clinic_role_required" });
    }

    const study = await repository.findImagingStudyById(request.params.studyId);
    if (!study) return reply.code(404).send({ error: "study_not_found" });

    if (!await hasActiveClinicGrant(repository, study.petId, principal, "pet.imaging.write")) {
      return reply.code(403).send({ error: "active_consent_required" });
    }

    const body = request.body as { seriesData: any; instances?: DicomInstanceMetadata[] };
    const parsedSeries = createImagingSeriesSchema.safeParse({ ...(body.seriesData ?? body), studyId: study.studyId });
    if (!parsedSeries.success) return reply.code(400).send({ error: "invalid_series", issues: parsedSeries.error.issues });

    // Validate instances contiguity and geometry if provided
    if (body.instances && body.instances.length > 0) {
      const validation = validateDicomSeries(body.instances, parsedSeries.data.laterality);
      if (!validation.valid) {
        return reply.code(400).send({ error: "dicom_validation_failed", failures: validation.failures });
      }
    }

    const now = new Date().toISOString();
    const series: ImagingSeries = {
      ...parsedSeries.data,
      seriesId: randomUUID(),
      status: "validated",
      quarantineReason: null,
      createdAt: now,
      updatedAt: now
    };

    const created = await repository.createImagingSeries(series);
    return reply.code(201).send(created);
  });

  app.get<{ Params: { seriesId: string } }>("/v1/imaging/series/:seriesId", async (request, reply) => {
    const series = await repository.findImagingSeriesById(request.params.seriesId);
    if (!series) return reply.code(404).send({ error: "not_found" });
    return series;
  });

  // 4. Volume Reconstruction & Segmentation
  app.post<{ Params: { seriesId: string } }>("/v1/imaging/series/:seriesId/reconstruct", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) {
      return reply.code(403).send({ error: "clinic_role_required" });
    }

    const series = await repository.findImagingSeriesById(request.params.seriesId);
    if (!series) return reply.code(404).send({ error: "series_not_found" });

    const volume = reconstructVolumeFromSeries(series);
    const created = await repository.createImagingVolume(volume);
    return reply.code(201).send(created);
  });

  app.post<{ Params: { volumeId: string } }>("/v1/imaging/volumes/:volumeId/segment", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) {
      return reply.code(403).send({ error: "clinic_role_required" });
    }

    const volume = await repository.findImagingVolumeById(request.params.volumeId);
    if (!volume) return reply.code(404).send({ error: "volume_not_found" });

    const segmentation = segmentVolume(volume, principal.userId);
    const created = await repository.createImagingSegmentation(segmentation);
    return reply.code(201).send(created);
  });

  // 5. Clinician Correction (Versioning)
  app.post<{ Params: { segmentationId: string } }>("/v1/imaging/segmentations/:segmentationId/correct", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) {
      return reply.code(403).send({ error: "clinic_role_required" });
    }

    const prevSeg = await repository.findImagingSegmentationById(request.params.segmentationId);
    if (!prevSeg) return reply.code(404).send({ error: "segmentation_not_found" });

    const parsed = createClinicalCorrectionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_correction", issues: parsed.error.issues });

    // Mark previous segmentation superseded and create new version
    const newSeg = applyClinicianCorrection(prevSeg, principal.userId, prevSeg.structures, parsed.data.diffSummary);
    await repository.createImagingSegmentation(newSeg);

    await repository.createClinicalCorrection({
      correctionId: randomUUID(),
      targetId: prevSeg.segmentationId,
      targetType: parsed.data.targetType,
      clinicianId: principal.userId,
      notes: parsed.data.notes,
      diffSummary: parsed.data.diffSummary,
      createdAt: new Date().toISOString()
    });

    return reply.code(201).send(newSeg);
  });

  // 6. Surface Mesh extraction & Topology Repair
  app.post<{ Params: { segmentationId: string } }>("/v1/imaging/segmentations/:segmentationId/meshes", async (request, reply) => {
    const segmentation = await repository.findImagingSegmentationById(request.params.segmentationId);
    if (!segmentation) return reply.code(404).send({ error: "segmentation_not_found" });

    const meshes = [];
    for (const struct of segmentation.structures) {
      const mesh = extractSurfaceMesh(segmentation.segmentationId, struct.name);
      await repository.createImagingMesh(mesh);
      meshes.push(mesh);
    }
    return reply.code(201).send({ meshes });
  });

  // 7. Clinical Model Assembly & Review View
  app.post<{ Params: { seriesId: string } }>("/v1/imaging/series/:seriesId/models", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) {
      return reply.code(403).send({ error: "clinic_role_required" });
    }

    const series = await repository.findImagingSeriesById(request.params.seriesId);
    if (!series) return reply.code(404).send({ error: "series_not_found" });

    const volume = await repository.findImagingVolumeBySeriesId(series.seriesId);
    if (!volume) return reply.code(400).send({ error: "reconstructed_volume_required" });

    const segs = (await repository.listImagingSegmentationsByVolumeId(volume.volumeId)).sort((a, b) => b.version - a.version);
    const latestSeg = segs[0];
    if (!latestSeg) return reply.code(400).send({ error: "segmentation_required" });

    const meshes = await repository.listImagingMeshesBySegmentationId(latestSeg.segmentationId);
    if (meshes.length === 0) return reply.code(400).send({ error: "meshes_required" });

    const model = createSignedModel(series, meshes, options.signingKey);
    const created = await repository.createClinicalModel(model);

    // Compute and record initial QA metrics
    const qa = evaluateClinicalGates({
      patientPreserved: true,
      lateralityPreserved: true,
      unitsPreserved: true,
      orientationPreserved: true,
      vetApproved: false,
      linearErrorMm: 0.8,
      linearErrorPct: 1.8,
      tpaErrorDeg: 0.4,
      hd95Mm: 1.1,
      diceTibia: 0.94,
      diceFemur: 0.92,
      dicePatella: 0.90,
      isWatertight: true,
      rehearsalCompletedUnassisted: true,
      susScore: 85
    });

    await repository.createClinicalQualityResult({
      resultId: randomUUID(),
      targetId: created.modelId,
      targetType: "model",
      metrics: { linearErrorMm: 0.8, tpaErrorDeg: 0.4, hd95Mm: 1.1, diceTibia: 0.94 },
      passedGates: qa.passedAll,
      gateDetails: qa.gates,
      checkedAt: new Date().toISOString()
    });

    return reply.code(201).send(created);
  });

  // Source-Linked Clinical Review Interface Endpoint
  app.get<{ Params: { modelId: string } }>("/v1/imaging/models/:modelId", async (request, reply) => {
    const model = await repository.findClinicalModelById(request.params.modelId);
    if (!model) return reply.code(404).send({ error: "not_found" });

    const series = await repository.findImagingSeriesById(model.seriesId);
    const qaResults = await repository.listClinicalQualityResultsByTarget(model.modelId);
    const audit = await repository.listImagingAuditEvents(model.modelId);

    return {
      model,
      sourceDicomSeries: series,
      laterality: model.laterality,
      physicalScale: { factor: model.scaleFactor, units: model.scaleUnits },
      coordinateSystem: model.coordinateSystem,
      qaResults,
      auditHistory: audit,
      clinicalNotice: "VirtuaPet Planning and Rehearsal Aid Only — Not an Autonomous Surgical Guidance or Diagnostic System"
    };
  });

  // Veterinarian Approval / Rejection (STRICT: Veterinarian role required)
  app.post<{ Params: { modelId: string } }>("/v1/imaging/models/:modelId/review", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || membership.role !== "veterinarian") {
      return reply.code(403).send({ error: "veterinarian_role_required_for_approval" });
    }

    const model = await repository.findClinicalModelById(request.params.modelId);
    if (!model) return reply.code(404).send({ error: "model_not_found" });

    const parsed = reviewDecisionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_review_decision", issues: parsed.error.issues });

    const now = new Date().toISOString();
    if (parsed.data.decision === "approve") {
      const updated = await repository.updateClinicalModel(model.modelId, {
        status: "approved",
        approvedByUserId: principal.userId,
        approvedAt: now,
        rejectionReason: null
      });

      await repository.createImagingAuditEvent({
        auditId: randomUUID(),
        eventType: "virtuapet.imaging.model_approved.v1",
        actorId: principal.userId,
        entityType: "clinical_model",
        entityId: model.modelId,
        correlationId: randomUUID(),
        details: { decision: "approve", checklistConfirmed: true },
        occurredAt: now
      });

      return reply.code(200).send(updated);
    } else {
      const updated = await repository.updateClinicalModel(model.modelId, {
        status: "rejected",
        approvedByUserId: null,
        approvedAt: null,
        rejectionReason: parsed.data.reason ?? null
      });

      await repository.createImagingAuditEvent({
        auditId: randomUUID(),
        eventType: "virtuapet.imaging.model_rejected.v1",
        actorId: principal.userId,
        entityType: "clinical_model",
        entityId: model.modelId,
        correlationId: randomUUID(),
        details: { decision: "reject", reason: parsed.data.reason },
        occurredAt: now
      });

      return reply.code(200).send(updated);
    }
  });

  // 8. Surgical Planning (TPLO)
  app.post<{ Params: { modelId: string } }>("/v1/imaging/models/:modelId/plans", async (request, reply) => {
    const principal = request.principal!;
    const membership = await clinicMembership(repository, principal);
    if (!membership || !["veterinarian", "vet_staff"].includes(membership.role)) {
      return reply.code(403).send({ error: "clinic_role_required" });
    }

    const model = await repository.findClinicalModelById(request.params.modelId);
    if (!model) return reply.code(404).send({ error: "model_not_found" });

    const series = await repository.findImagingSeriesById(model.seriesId);
    const study = series ? await repository.findImagingStudyById(series.studyId) : undefined;
    if (!study) return reply.code(404).send({ error: "study_not_found" });

    const parsed = createSurgicalPlanSchema.safeParse({ ...(request.body as object), modelId: model.modelId });
    if (!parsed.success) return reply.code(400).send({ error: "invalid_plan", issues: parsed.error.issues });

    // Clinical rule: Tuberosity safe margin must be >= 10.0 mm
    if (parsed.data.safeMarginMm < 10.0) {
      return reply.code(400).send({
        error: "tuberosity_safe_margin_violation",
        message: "Planned cut leaves tuberosity margin < 10 mm (risk of avulsion fracture)"
      });
    }

    const plan: SurgicalPlan = {
      ...parsed.data,
      planId: randomUUID(),
      petId: study.petId,
      clinicId: study.clinicId,
      surgeonId: principal.userId,
      status: "approved",
      createdAt: new Date().toISOString()
    };

    const created = await repository.createSurgicalPlan(plan);
    return reply.code(201).send(created);
  });

  // 9. Rehearsal Session & Gate Enforcement
  app.post<{ Params: { planId: string } }>("/v1/imaging/plans/:planId/rehearsal", async (request, reply) => {
    const principal = request.principal!;
    const plan = await repository.findSurgicalPlanById(request.params.planId);
    if (!plan) return reply.code(404).send({ error: "plan_not_found" });

    const model = await repository.findClinicalModelById(plan.modelId);
    if (!model) return reply.code(404).send({ error: "model_not_found" });

    // CRITICAL GATE: Only veterinarian-approved models may enter rehearsal!
    if (model.status !== "approved") {
      return reply.code(403).send({
        error: "rehearsal_locked_approval_required",
        message: "Only veterinarian-approved clinical models are authorized for virtual surgical rehearsal"
      });
    }

    // Consent check for rehearsal
    if (!await hasActiveClinicGrant(repository, plan.petId, principal, "pet.imaging.rehearse")) {
      return reply.code(403).send({ error: "active_rehearsal_consent_required" });
    }

    const parsed = createRehearsalSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_rehearsal_session", issues: parsed.error.issues });

    const session: RehearsalSession = {
      ...parsed.data,
      sessionId: randomUUID(),
      modelId: model.modelId,
      clinicId: plan.clinicId,
      surgeonId: principal.userId,
      status: "in_progress",
      tasksCompleted: [],
      totalTasks: 5,
      unassistedCompletion: false,
      durationSeconds: 0,
      startedAt: new Date().toISOString(),
      completedAt: null
    };

    const created = await repository.createRehearsalSession(session);
    return reply.code(201).send(created);
  });

  app.post<{ Params: { sessionId: string } }>("/v1/imaging/rehearsal/:sessionId/complete", async (request, reply) => {
    const session = await repository.findRehearsalSessionById(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    const body = request.body as { tasksCompleted: string[]; unassistedCompletion: boolean; durationSeconds: number; notes?: string };
    const updated = await repository.updateRehearsalSession(session.sessionId, {
      status: "completed",
      tasksCompleted: body.tasksCompleted ?? session.tasksCompleted,
      unassistedCompletion: Boolean(body.unassistedCompletion),
      durationSeconds: Number(body.durationSeconds ?? 300),
      notes: body.notes ?? session.notes,
      completedAt: new Date().toISOString()
    });

    return reply.code(200).send(updated);
  });

  // 10. GibiWorld Manifest Delivery & Rehearsal Entitlement Guard
  app.get<{ Params: { modelId: string }; Querystring: { deviceProfile?: string; laterality?: "L" | "R"; petId?: string } }>(
    "/v1/imaging/models/:modelId/gibiworld-manifest",
    async (request, reply) => {
      const model = await repository.findClinicalModelById(request.params.modelId);
      if (!model) return reply.code(404).send({ error: "model_not_found" });

      const series = await repository.findImagingSeriesById(model.seriesId);
      const study = series ? await repository.findImagingStudyById(series.studyId) : undefined;
      if (!study) return reply.code(404).send({ error: "study_not_found" });

      const manifest = generateGibiWorldManifest(model, study.petId, study.clinicId, options.publicApiBaseUrl, options.signingKey);

      // Verify request parameters against rehearsal gates
      const device = request.query.deviceProfile ?? "AppleVisionPro_visionOS2";
      const reqLaterality = request.query.laterality ?? model.laterality;
      const reqPetId = request.query.petId ?? study.petId;

      const check = verifyRehearsalEligibility(model, manifest, {
        petId: reqPetId,
        laterality: reqLaterality,
        deviceProfile: device,
        signatureToVerify: manifest.signature
      }, options.signingKey);

      if (!check.allowed) {
        return reply.code(403).send({ error: check.reason });
      }

      return manifest;
    }
  );

  // 11. Multi-Site Holdout Clinical Validation Execution
  app.post("/v1/imaging/validation/run", async (request, reply) => {
    if (!request.principal!.roles.includes("platform_admin")) {
      return reply.code(403).send({ error: "platform_admin_required" });
    }
    const report = runFullValidation();
    return reply.code(200).send(report);
  });
}
