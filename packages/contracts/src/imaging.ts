import { z } from "zod";
const uuidSchema = z.string().uuid();

export const lateralitySchema = z.enum(["L", "R"]);
export const modalitySchema = z.enum(["CT"]);

export const studyStatusSchema = z.enum(["received", "quarantined", "validated", "failed_validation"]);
export const seriesStatusSchema = z.enum(["received", "quarantined", "validated", "failed_validation"]);

export const pipelineStatusSchema = z.enum([
  "received",
  "quarantined",
  "validated",
  "reconstructed",
  "segmented",
  "clinician_review",
  "approved",
  "packaged",
  "rehearsed",
  "archived",
  "rejected",
  "superseded"
]);

export const createImagingStudySchema = z.object({
  petId: uuidSchema,
  clinicId: uuidSchema,
  studyInstanceUid: z.string().trim().min(5).max(128),
  accessionNumber: z.string().trim().max(64).optional(),
  studyDescription: z.string().trim().max(256).optional(),
  studyDate: z.string().date().optional(),
  patientNameAnonymized: z.string().trim().min(1).max(128)
}).strict();

export const imagingStudySchema = createImagingStudySchema.extend({
  studyId: uuidSchema,
  status: studyStatusSchema,
  createdAt: z.string().datetime()
}).strict();

export const createImagingSeriesSchema = z.object({
  studyId: uuidSchema,
  seriesInstanceUid: z.string().trim().min(5).max(128),
  modality: modalitySchema,
  laterality: lateralitySchema,
  bodyPartExamined: z.string().trim().min(1).max(64),
  sliceThickness: z.number().positive().max(5.0),
  pixelSpacing: z.tuple([z.number().positive().max(2.0), z.number().positive().max(2.0)]),
  imageOrientationPatient: z.tuple([
    z.number(), z.number(), z.number(),
    z.number(), z.number(), z.number()
  ]),
  rows: z.number().int().min(128).max(4096),
  columns: z.number().int().min(128).max(4096),
  sliceCount: z.number().int().min(5).max(2000),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/i)
}).strict();

export const imagingSeriesSchema = createImagingSeriesSchema.extend({
  seriesId: uuidSchema,
  status: seriesStatusSchema,
  quarantineReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const imagingVolumeSchema = z.object({
  volumeId: uuidSchema,
  seriesId: uuidSchema,
  dimensions: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]),
  spacing: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  origin: z.tuple([z.number(), z.number(), z.number()]),
  coordinateFrame: z.literal("DICOM_LPS"),
  units: z.literal("HU"),
  volumeHash: z.string().regex(/^[a-f0-9]{64}$/i),
  createdAt: z.string().datetime()
}).strict();

export const structureLabelSchema = z.object({
  structureId: z.string().min(1),
  name: z.string().min(1),
  labelValue: z.number().int().positive(),
  colorRgb: z.tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)])
}).strict();

export const imagingSegmentationSchema = z.object({
  segmentationId: uuidSchema,
  volumeId: uuidSchema,
  parentSegmentationId: uuidSchema.nullable(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "clinician_reviewed", "approved", "superseded"]),
  structures: z.array(structureLabelSchema).min(1),
  algorithmVersion: z.string().min(1),
  operatorId: uuidSchema,
  uncertaintyScore: z.number().min(0.0).max(1.0),
  segmentationHash: z.string().regex(/^[a-f0-9]{64}$/i),
  createdAt: z.string().datetime()
}).strict();

export const imagingMeshSchema = z.object({
  meshId: uuidSchema,
  segmentationId: uuidSchema,
  structureName: z.string().min(1),
  vertexCount: z.number().int().positive(),
  triangleCount: z.number().int().positive(),
  isWatertight: z.boolean(),
  topologyRepaired: z.boolean(),
  surfaceHash: z.string().regex(/^[a-f0-9]{64}$/i),
  createdAt: z.string().datetime()
}).strict();

export const clinicalModelStructureSchema = z.object({
  structureName: z.string(),
  meshId: uuidSchema,
  vertexCount: z.number().int(),
  triangleCount: z.number().int(),
  isWatertight: z.boolean()
}).strict();

export const clinicalModelSchema = z.object({
  modelId: uuidSchema,
  seriesId: uuidSchema,
  version: z.number().int().positive(),
  status: pipelineStatusSchema,
  structures: z.array(clinicalModelStructureSchema).min(1),
  laterality: lateralitySchema,
  scaleFactor: z.number().positive(),
  scaleUnits: z.enum(["mm", "m"]),
  coordinateSystem: z.enum(["LPS", "glTF_Y_UP"]),
  signature: z.string().min(16),
  entitlementScope: z.string().min(1),
  rollbackTargetId: uuidSchema.nullable(),
  approvedByUserId: uuidSchema.nullable(),
  approvedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const createSurgicalPlanSchema = z.object({
  modelId: uuidSchema,
  targetTpaDegrees: z.number().min(3.0).max(8.0),
  measuredTpaDegrees: z.number().min(12.0).max(45.0),
  bladeRadiusMm: z.union([z.literal(18), z.literal(24), z.literal(27), z.literal(30), z.literal(33)]),
  rotationDistanceMm: z.number().positive().max(20.0),
  safeMarginMm: z.number().min(0.0),
  notes: z.string().trim().max(1000).optional()
}).strict();

export const surgicalPlanSchema = createSurgicalPlanSchema.extend({
  planId: uuidSchema,
  petId: uuidSchema,
  clinicId: uuidSchema,
  surgeonId: uuidSchema,
  status: z.enum(["draft", "approved", "superseded"]),
  createdAt: z.string().datetime()
}).strict();

export const rehearsalSessionStatusSchema = z.enum(["initialized", "in_progress", "completed", "aborted"]);

export const createRehearsalSessionSchema = z.object({
  planId: uuidSchema,
  deviceProfile: z.enum(["AppleVisionPro_visionOS2", "MetaQuest3_OpenXR", "WebXR_Simulator"]),
  notes: z.string().trim().max(1000).optional()
}).strict();

export const rehearsalSessionSchema = createRehearsalSessionSchema.extend({
  sessionId: uuidSchema,
  modelId: uuidSchema,
  clinicId: uuidSchema,
  surgeonId: uuidSchema,
  status: rehearsalSessionStatusSchema,
  tasksCompleted: z.array(z.string()),
  totalTasks: z.number().int().positive(),
  unassistedCompletion: z.boolean(),
  durationSeconds: z.number().min(0),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable()
}).strict();

export const qualityGateDetailSchema = z.object({
  gateId: z.string(),
  name: z.string(),
  threshold: z.string(),
  actual: z.number(),
  passed: z.boolean()
}).strict();

export const clinicalQualityResultSchema = z.object({
  resultId: uuidSchema,
  targetId: uuidSchema,
  targetType: z.enum(["series", "volume", "segmentation", "mesh", "model"]),
  metrics: z.record(z.number()),
  passedGates: z.boolean(),
  gateDetails: z.array(qualityGateDetailSchema),
  checkedAt: z.string().datetime()
}).strict();

export const createClinicalCorrectionSchema = z.object({
  targetId: uuidSchema,
  targetType: z.enum(["segmentation", "mesh", "landmarks", "cut_plane"]),
  notes: z.string().trim().min(5).max(2000),
  diffSummary: z.string().trim().min(3).max(2000)
}).strict();

export const clinicalCorrectionSchema = createClinicalCorrectionSchema.extend({
  correctionId: uuidSchema,
  clinicianId: uuidSchema,
  createdAt: z.string().datetime()
}).strict();

export const reviewDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(5).max(1000).optional(),
  checklistConfirmed: z.boolean()
}).strict().superRefine((val, ctx) => {
  if (val.decision === "approve" && !val.checklistConfirmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Checklist must be confirmed before approval", path: ["checklistConfirmed"] });
  }
  if (val.decision === "reject" && !val.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rejection reason is required", path: ["reason"] });
  }
});

export const gibiWorldManifestSchema = z.object({
  manifestVersion: z.literal("1.0.0"),
  modelId: uuidSchema,
  petId: uuidSchema,
  clinicId: uuidSchema,
  assetUrl: z.string().url(),
  assetHash: z.string().regex(/^[a-f0-9]{64}$/i),
  signature: z.string().min(16),
  entitlementScope: z.string(),
  expiresAt: z.string().datetime(),
  laterality: lateralitySchema,
  physicalScale: z.number().positive(),
  scaleUnits: z.enum(["mm", "m"]),
  coordinateSystem: z.literal("glTF_Y_UP"),
  supportedDeviceProfiles: z.array(z.string()).min(1),
  status: z.literal("approved_ready_for_rehearsal"),
  rollbackTargetId: uuidSchema.nullable()
}).strict();

export const imagingAuditEventSchema = z.object({
  auditId: uuidSchema,
  eventType: z.string().regex(/^virtuapet\.imaging\.[a-z0-9_.]+\.v[1-9][0-9]*$/),
  actorId: uuidSchema,
  entityType: z.string().min(1),
  entityId: uuidSchema,
  correlationId: uuidSchema,
  details: z.record(z.unknown()),
  occurredAt: z.string().datetime()
}).strict();

export type ImagingStudy = z.infer<typeof imagingStudySchema>;
export type CreateImagingStudy = z.infer<typeof createImagingStudySchema>;
export type ImagingSeries = z.infer<typeof imagingSeriesSchema>;
export type CreateImagingSeries = z.infer<typeof createImagingSeriesSchema>;
export type ImagingVolume = z.infer<typeof imagingVolumeSchema>;
export type ImagingSegmentation = z.infer<typeof imagingSegmentationSchema>;
export type ImagingMesh = z.infer<typeof imagingMeshSchema>;
export type ClinicalModel = z.infer<typeof clinicalModelSchema>;
export type SurgicalPlan = z.infer<typeof surgicalPlanSchema>;
export type CreateSurgicalPlan = z.infer<typeof createSurgicalPlanSchema>;
export type RehearsalSession = z.infer<typeof rehearsalSessionSchema>;
export type CreateRehearsalSession = z.infer<typeof createRehearsalSessionSchema>;
export type ClinicalQualityResult = z.infer<typeof clinicalQualityResultSchema>;
export type ClinicalCorrection = z.infer<typeof clinicalCorrectionSchema>;
export type CreateClinicalCorrection = z.infer<typeof createClinicalCorrectionSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type GibiWorldManifest = z.infer<typeof gibiWorldManifestSchema>;
export type ImagingAuditEvent = z.infer<typeof imagingAuditEventSchema>;

export type QualityGateDetail = z.infer<typeof qualityGateDetailSchema>;
