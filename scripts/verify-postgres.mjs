import { randomUUID } from "node:crypto";
import { PostgresPetRepository } from "../apps/api/dist/postgres-repository.js";
import { signSpatialAssetManifest } from "../packages/contracts/dist/index.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const repository = PostgresPetRepository.fromConnectionString(process.env.DATABASE_URL);
const guardianId = randomUUID();
const petId = randomUUID();
const clinicId = randomUUID();
try {
  const now = new Date().toISOString();
  // Phase 2 Verifications
  await repository.create({ petId, guardianId, name: "Migration Test", species: "cat", createdAt: now, updatedAt: now, recordVersion: 1 });
  const read = await repository.findById(petId);
  if (read?.guardianId !== guardianId) throw new Error("Pet repository round trip failed");
  const grantId = randomUUID();
  await repository.createGrant({ grantId, petId, grantorUserId: guardianId, granteeId: clinicId, scopes: ["pet.health.observation.write", "pet.imaging.read", "pet.imaging.write", "pet.imaging.rehearse"], purpose: "Persistent repository verification", startsAt: now, expiresAt: new Date(Date.now() + 3600000).toISOString(), revokedAt: null });
  if ((await repository.listGrants(petId)).length !== 1) throw new Error("Consent repository round trip failed");
  await repository.revokeGrant(grantId, new Date().toISOString());
  if (!(await repository.listGrants(petId))[0]?.revokedAt) throw new Error("Consent revocation failed");
  await repository.createGrimaceAssessment({ assessmentId: randomUUID(), petId, assessorUserId: randomUUID(), clinicId, assessedAt: now, assessorTrainingConfirmed: true, actionUnits: { earPosition: 1, orbitalTightening: 1, muzzleTension: 1, whiskersPosition: 1, headPosition: 0 }, totalScore: 4, veterinaryReviewRequired: true, recordedAt: now });
  if ((await repository.listGrimaceAssessments(petId))[0]?.totalScore !== 4) throw new Error("FGS repository round trip failed");
  await repository.createOrganization({organizationId:clinicId,name:"Persistent Test Clinic",kind:"clinic",createdAt:now});
  const clinicUserId=randomUUID(); await repository.createMembership({membershipId:randomUUID(),organizationId:clinicId,userId:clinicUserId,role:"veterinarian",status:"active",createdAt:now,revokedAt:null});
  if((await repository.findMembership(clinicId,clinicUserId))?.role!=="veterinarian") throw new Error("Membership repository round trip failed");
  await repository.createAppointment({appointmentId:randomUUID(),clinicId,petId,startsAt:new Date(Date.now()+3600000).toISOString(),durationMinutes:30,reason:"Persistence verification",status:"scheduled",createdByUserId:clinicUserId,createdAt:now});
  if((await repository.listAppointments(clinicId)).length!==1) throw new Error("Appointment repository round trip failed");
  await repository.createRecall({recallId:randomUUID(),clinicId,petId,dueAt:new Date(Date.now()+7200000).toISOString(),reason:"Persistence verification",status:"open",createdByUserId:clinicUserId,createdAt:now});
  await repository.createInventoryItem({inventoryItemId:randomUUID(),clinicId,sku:"VERIFY-1",name:"Verification item",quantityOnHand:1,reorderPoint:1,updatedByUserId:clinicUserId,updatedAt:now});
  await repository.createClinicMessage({messageId:randomUUID(),clinicId,petId,subject:"Verification",body:"Persistent message verification",authorUserId:clinicUserId,createdAt:now});

  // Phase 3 Clinical Imaging Verifications
  const studyId = randomUUID();
  const studyUid = "1.2.840.10008.1.2.4." + Date.now();
  await repository.createImagingStudy({
    studyId, petId, clinicId, studyInstanceUid: studyUid,
    accessionNumber: "ACC-001", studyDescription: "Canine Stifle CT TPLO",
    studyDate: now.slice(0, 10), patientNameAnonymized: "CANINE-HOLD-01",
    status: "validated", createdAt: now
  });
  const readStudy = await repository.findImagingStudyById(studyId);
  if (!readStudy || readStudy.studyInstanceUid !== studyUid) throw new Error("Imaging study round trip failed");

  const seriesId = randomUUID();
  const seriesUid = studyUid + ".1";
  await repository.createImagingSeries({
    seriesId, studyId, seriesInstanceUid: seriesUid, modality: "CT", laterality: "L",
    bodyPartExamined: "STIFLE", sliceThickness: 1.0, pixelSpacing: [0.5, 0.5],
    imageOrientationPatient: [1, 0, 0, 0, 1, 0], rows: 512, columns: 512, sliceCount: 120,
    status: "validated", quarantineReason: null,
    sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    createdAt: now, updatedAt: now
  });
  const readSeries = await repository.findImagingSeriesById(seriesId);
  if (!readSeries || readSeries.laterality !== "L") throw new Error("Imaging series round trip failed");

  const volumeId = randomUUID();
  await repository.createImagingVolume({
    volumeId, seriesId, dimensions: [512, 512, 120], spacing: [0.5, 0.5, 1.0],
    origin: [-128, -128, 0], coordinateFrame: "DICOM_LPS", units: "HU",
    volumeHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    createdAt: now
  });
  const readVolume = await repository.findImagingVolumeById(volumeId);
  if (!readVolume || readVolume.coordinateFrame !== "DICOM_LPS") throw new Error("Imaging volume round trip failed");

  const segmentationId = randomUUID();
  await repository.createImagingSegmentation({
    segmentationId, volumeId, parentSegmentationId: null, version: 1, status: "approved",
    structures: [
      { structureId: "tibia", name: "Proximal Tibia", labelValue: 1, colorRgb: [220, 200, 170] },
      { structureId: "femur", name: "Distal Femur", labelValue: 2, colorRgb: [200, 180, 150] },
      { structureId: "patella", name: "Patella", labelValue: 3, colorRgb: [240, 230, 210] }
    ],
    algorithmVersion: "tplo_seg_v1.0.0", operatorId: clinicUserId, uncertaintyScore: 0.04,
    segmentationHash: "b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    createdAt: now
  });
  const readSeg = await repository.findImagingSegmentationById(segmentationId);
  if (!readSeg || readSeg.structures.length !== 3) throw new Error("Imaging segmentation round trip failed");

  const meshId = randomUUID();
  await repository.createImagingMesh({
    meshId, segmentationId, structureName: "tibia", vertexCount: 15420, triangleCount: 30836,
    isWatertight: true, topologyRepaired: true,
    surfaceHash: "c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    createdAt: now
  });
  const readMeshes = await repository.listImagingMeshesBySegmentationId(segmentationId);
  if (readMeshes.length !== 1 || !readMeshes[0].isWatertight) throw new Error("Imaging mesh round trip failed");

  const modelId = randomUUID();
  await repository.createClinicalModel({
    modelId, seriesId, version: 1, status: "approved",
    structures: [{ structureName: "tibia", meshId, vertexCount: 15420, triangleCount: 30836, isWatertight: true }],
    laterality: "L", scaleFactor: 1.0, scaleUnits: "mm", coordinateSystem: "glTF_Y_UP",
    signature: "sig_ed25519_verified_signature_9876543210abcdef", entitlementScope: "clinical.twin.rehearsal",
    rollbackTargetId: null, approvedByUserId: clinicUserId, approvedAt: now, rejectionReason: null,
    createdAt: now, updatedAt: now
  });
  const readModel = await repository.findClinicalModelById(modelId);
  if (!readModel || readModel.status !== "approved" || readModel.laterality !== "L") throw new Error("Clinical model round trip failed");

  const planId = randomUUID();
  await repository.createSurgicalPlan({
    planId, modelId, petId, clinicId, surgeonId: clinicUserId,
    targetTpaDegrees: 5.0, measuredTpaDegrees: 27.5, bladeRadiusMm: 24,
    rotationDistanceMm: 7.8, safeMarginMm: 12.2, notes: "Standard 24mm radial blade planned",
    status: "approved", createdAt: now
  });
  const readPlan = await repository.findSurgicalPlanById(planId);
  if (!readPlan || readPlan.bladeRadiusMm !== 24) throw new Error("Surgical plan round trip failed");

  const sessionId = randomUUID();
  await repository.createRehearsalSession({
    sessionId, planId, modelId, clinicId, surgeonId: clinicUserId,
    deviceProfile: "AppleVisionPro_visionOS2", status: "completed",
    tasksCompleted: ["verify_landmarks", "position_cut", "radial_osteotomy", "rotate_segment", "check_tuberosity_margin"],
    totalTasks: 5, unassistedCompletion: true, durationSeconds: 420.5,
    notes: "Flawless unassisted simulated rotation", startedAt: now, completedAt: now
  });
  const readSession = await repository.findRehearsalSessionById(sessionId);
  if (!readSession || !readSession.unassistedCompletion) throw new Error("Rehearsal session round trip failed");

  const resultId = randomUUID();
  await repository.createClinicalQualityResult({
    resultId, targetId: modelId, targetType: "model",
    metrics: { diceTibia: 0.945, hd95Mm: 1.15, tpaErrorDeg: 0.45 },
    passedGates: true,
    gateDetails: [
      { gateId: "GATE-04", name: "Linear Error", threshold: "<= 1.5mm", actual: 0.85, passed: true },
      { gateId: "GATE-05", name: "TPA Angular Error", threshold: "<= 1.0 deg", actual: 0.45, passed: true },
      { gateId: "GATE-06", name: "Surface HD95", threshold: "<= 1.5mm", actual: 1.15, passed: true }
    ],
    checkedAt: now
  });
  const readQA = await repository.listClinicalQualityResultsByTarget(modelId);
  if (readQA.length !== 1 || !readQA[0].passedGates) throw new Error("Clinical QA round trip failed");

  const correctionId = randomUUID();
  await repository.createClinicalCorrection({
    correctionId, targetId: segmentationId, targetType: "segmentation", clinicianId: clinicUserId,
    notes: "Refined proximal tibial plateau boundary", diffSummary: "Adjusted 45 boundary voxels along caudal slope",
    createdAt: now
  });
  const readCorr = await repository.listClinicalCorrectionsByTarget(segmentationId);
  if (readCorr.length !== 1) throw new Error("Clinical correction round trip failed");

  const auditId = randomUUID();
  await repository.createImagingAuditEvent({
    auditId, eventType: "virtuapet.imaging.model_approved.v1", actorId: clinicUserId,
    entityType: "clinical_model", entityId: modelId, correlationId: randomUUID(),
    details: { version: 1, laterality: "L", decision: "approve" }, occurredAt: now
  });
  const readAudit = await repository.listImagingAuditEvents(modelId);
  if (readAudit.length !== 1) throw new Error("Imaging audit event round trip failed");

  // Phase 4 signed spatial-manifest persistence
  const assetId = randomUUID();
  const manifest = signSpatialAssetManifest({
    manifestVersion: "2.0.0", assetId, version: 1, ownerId: guardianId, tenantId: clinicId,
    source: "pawsome3d", provenance: {
      generator: "Pawsome3D verification fixture", generatedAt: now,
      sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      sourceReference: "local-postgres-verification", lineage: ["synthetic_fixture"]
    },
    glbUri: "https://assets.virtuapet.com/verification/pet.glb",
    sha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
    units: "mm", scale: 1, upAxis: "Y_UP", forwardAxis: "NEGATIVE_Z_FORWARD",
    laterality: "L", bounds: { min: [-1, 0, -1], max: [1, 2, 1] }, origin: [0, 0, 0],
    supportedAnimationClips: ["idle"], entitlementRequirements: ["spatial.asset.view"],
    expiresAt: new Date(Date.now() + 3600000).toISOString(), revokedAt: null, isRevoked: false,
    minClientVersion: "1.0.0", rollbackVersion: null
  }, "local-verification-key-not-for-production");
  await repository.createSpatialManifest(manifest);
  if ((await repository.findSpatialManifestById(assetId))?.sha256 !== manifest.sha256) throw new Error("Spatial manifest round trip failed");
  if ((await repository.listSpatialManifestsByTenant(clinicId)).length !== 1) throw new Error("Spatial tenant listing failed");
  if (!(await repository.revokeSpatialManifest(assetId, new Date().toISOString()))?.isRevoked) throw new Error("Spatial manifest revocation failed");

  console.log("PostgreSQL Phase 2, Phase 3, and Phase 4 repository verification passed");
} finally {
  await repository.close();
}
