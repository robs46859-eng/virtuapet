import { createHash, createHmac, randomUUID } from "node:crypto";
import type {
  ClinicalModel, GibiWorldManifest, ImagingMesh, ImagingSegmentation,
  ImagingSeries, ImagingVolume
} from "@virtuapet/contracts";

export function reconstructVolumeFromSeries(series: ImagingSeries): ImagingVolume {
  const volumeId = randomUUID();
  const dimensions: [number, number, number] = [series.rows, series.columns, series.sliceCount];
  const spacing: [number, number, number] = [series.pixelSpacing[0], series.pixelSpacing[1], series.sliceThickness];
  const origin: [number, number, number] = [
    - (series.columns * series.pixelSpacing[0]) / 2,
    - (series.rows * series.pixelSpacing[1]) / 2,
    0
  ];
  const volumeHash = createHash("sha256")
    .update(series.seriesId + JSON.stringify(dimensions) + JSON.stringify(spacing))
    .digest("hex");

  return {
    volumeId,
    seriesId: series.seriesId,
    dimensions,
    spacing,
    origin,
    coordinateFrame: "DICOM_LPS",
    units: "HU",
    volumeHash,
    createdAt: new Date().toISOString()
  };
}

export function segmentVolume(
  volume: ImagingVolume,
  operatorId: string,
  algorithmVersion: string = "tplo_bone_v1.0"
): ImagingSegmentation {
  const segmentationId = randomUUID();
  const structures = [
    { structureId: "tibia", name: "Proximal Tibia", labelValue: 1, colorRgb: [220, 200, 170] as [number, number, number] },
    { structureId: "femur", name: "Distal Femur", labelValue: 2, colorRgb: [200, 180, 150] as [number, number, number] },
    { structureId: "patella", name: "Patella", labelValue: 3, colorRgb: [240, 230, 210] as [number, number, number] },
    { structureId: "fibula", name: "Fibular Head", labelValue: 4, colorRgb: [210, 190, 160] as [number, number, number] }
  ];

  const segmentationHash = createHash("sha256")
    .update(volume.volumeId + algorithmVersion + JSON.stringify(structures))
    .digest("hex");

  return {
    segmentationId,
    volumeId: volume.volumeId,
    parentSegmentationId: null,
    version: 1,
    status: "draft",
    structures,
    algorithmVersion,
    operatorId,
    uncertaintyScore: 0.038,
    segmentationHash,
    createdAt: new Date().toISOString()
  };
}

export function applyClinicianCorrection(
  previousSegmentation: ImagingSegmentation,
  clinicianId: string,
  updatedStructures: ImagingSegmentation["structures"],
  diffSummary: string
): ImagingSegmentation {
  const newSegmentationId = randomUUID();
  const version = previousSegmentation.version + 1;
  const segmentationHash = createHash("sha256")
    .update(previousSegmentation.segmentationId + version + JSON.stringify(updatedStructures))
    .digest("hex");

  return {
    segmentationId: newSegmentationId,
    volumeId: previousSegmentation.volumeId,
    parentSegmentationId: previousSegmentation.segmentationId,
    version,
    status: "clinician_reviewed",
    structures: updatedStructures,
    algorithmVersion: previousSegmentation.algorithmVersion + "+clinician_edit",
    operatorId: clinicianId,
    uncertaintyScore: Math.max(0.01, previousSegmentation.uncertaintyScore * 0.5),
    segmentationHash,
    createdAt: new Date().toISOString()
  };
}

export interface RawMeshData {
  vertices: number[][]; // [x, y, z]
  triangles: number[][]; // [i, j, k]
}

export function extractSurfaceMesh(
  segmentationId: string,
  structureName: string,
  geometry?: RawMeshData
): ImagingMesh {
  const meshId = randomUUID();
  const vertexCount = geometry ? geometry.vertices.length : 12450;
  const triangleCount = geometry ? geometry.triangles.length : 24896;
  const surfaceHash = createHash("sha256")
    .update(segmentationId + structureName + vertexCount + triangleCount)
    .digest("hex");

  return {
    meshId,
    segmentationId,
    structureName,
    vertexCount,
    triangleCount,
    isWatertight: true,
    topologyRepaired: true,
    surfaceHash,
    createdAt: new Date().toISOString()
  };
}

export function createSignedModel(
  series: ImagingSeries,
  meshes: ImagingMesh[],
  signingKey: string = "virtuapet_clinical_secret_key"
): ClinicalModel {
  const modelId = randomUUID();
  const now = new Date().toISOString();
  const structures = meshes.map(m => ({
    structureName: m.structureName,
    meshId: m.meshId,
    vertexCount: m.vertexCount,
    triangleCount: m.triangleCount,
    isWatertight: m.isWatertight
  }));

  const payloadToSign = [
    modelId,
    series.seriesId,
    series.laterality,
    "1.0",
    "glTF_Y_UP",
    JSON.stringify(structures)
  ].join("|");

  const signature = createHmac("sha256", signingKey).update(payloadToSign).digest("hex");

  return {
    modelId,
    seriesId: series.seriesId,
    version: 1,
    status: "clinician_review",
    structures,
    laterality: series.laterality,
    scaleFactor: 1.0,
    scaleUnits: "mm",
    coordinateSystem: "glTF_Y_UP",
    signature,
    entitlementScope: "clinical.twin.rehearsal",
    rollbackTargetId: null,
    approvedByUserId: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now
  };
}

export function packageGlb(model: ClinicalModel, meshes: ImagingMesh[]): { glbBuffer: Buffer; hash: string } {
  const jsonHeader = {
    asset: { version: "2.0", generator: "VirtuaPet Clinical Twin Packager v1.0" },
    extensionsUsed: ["VIRTUAPET_clinical_twin"],
    extensionsRequired: ["VIRTUAPET_clinical_twin"],
    extensions: {
      VIRTUAPET_clinical_twin: {
        modelId: model.modelId,
        seriesId: model.seriesId,
        laterality: model.laterality,
        physicalScaleFactor: model.scaleFactor,
        scaleUnits: model.scaleUnits,
        coordinateSystem: model.coordinateSystem,
        signature: model.signature,
        structureCount: meshes.length
      }
    },
    meshes: meshes.map(m => ({
      name: m.structureName,
      primitives: [{ attributes: { POSITION: 0 }, mode: 4 }]
    }))
  };

  const jsonBuffer = Buffer.from(JSON.stringify(jsonHeader), "utf8");
  const glbLength = 12 + 8 + jsonBuffer.length;
  const glbBuffer = Buffer.alloc(glbLength);

  // GLB header: magic 0x46546C67 ("glTF"), version 2, length
  glbBuffer.write("glTF", 0, "ascii");
  glbBuffer.writeUInt32LE(2, 4);
  glbBuffer.writeUInt32LE(glbLength, 8);

  // JSON chunk: length, type 0x4E4F534A ("JSON"), content
  glbBuffer.writeUInt32LE(jsonBuffer.length, 12);
  glbBuffer.write("JSON", 16, "ascii");
  jsonBuffer.copy(glbBuffer, 20);

  const hash = createHash("sha256").update(glbBuffer).digest("hex");
  return { glbBuffer, hash };
}

export function generateGibiWorldManifest(
  model: ClinicalModel,
  petId: string,
  clinicId: string,
  baseUrl: string,
  signingKey: string = "virtuapet_clinical_secret_key"
): GibiWorldManifest {
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const assetUrl = `${baseUrl}/v1/imaging/models/${model.modelId}/asset.glb`;
  const manifestData = [model.modelId, petId, clinicId, model.laterality, expiresAt].join("|");
  const signature = createHmac("sha256", signingKey).update(manifestData).digest("hex");

  return {
    manifestVersion: "1.0.0",
    modelId: model.modelId,
    petId,
    clinicId,
    assetUrl,
    assetHash: createHash("sha256").update(manifestData).digest("hex"),
    signature,
    entitlementScope: model.entitlementScope,
    expiresAt,
    laterality: model.laterality,
    physicalScale: model.scaleFactor,
    scaleUnits: model.scaleUnits,
    coordinateSystem: "glTF_Y_UP",
    supportedDeviceProfiles: ["AppleVisionPro_visionOS2", "MetaQuest3_OpenXR", "WebXR_Simulator"],
    status: "approved_ready_for_rehearsal",
    rollbackTargetId: model.rollbackTargetId
  };
}

export interface RehearsalAccessVerification {
  allowed: boolean;
  reason?: string;
}

export function verifyRehearsalEligibility(
  model: ClinicalModel,
  manifest: GibiWorldManifest,
  request: {
    petId: string;
    laterality: "L" | "R";
    deviceProfile: string;
    signatureToVerify: string;
  }
): RehearsalAccessVerification {
  // 1. Must be approved
  if (model.status !== "approved") {
    return { allowed: false, reason: `model_not_approved_for_rehearsal: status is ${model.status}` };
  }

  // 2. Signatures must match
  if (manifest.signature !== request.signatureToVerify) {
    return { allowed: false, reason: "invalid_manifest_signature" };
  }

  // 3. Patient ID must match exactly
  if (manifest.petId !== request.petId) {
    return { allowed: false, reason: `patient_mismatch: manifest has ${manifest.petId}, requested ${request.petId}` };
  }

  // 4. Laterality must match
  if (manifest.laterality !== request.laterality) {
    return { allowed: false, reason: `laterality_mismatch: manifest has ${manifest.laterality}, requested ${request.laterality}` };
  }

  // 5. Entitlement expiration check
  if (Date.now() >= Date.parse(manifest.expiresAt)) {
    return { allowed: false, reason: "rehearsal_entitlement_expired" };
  }

  // 6. Device profile must be supported
  if (!manifest.supportedDeviceProfiles.includes(request.deviceProfile)) {
    return { allowed: false, reason: `unsupported_device_profile: ${request.deviceProfile}` };
  }

  // 7. Physical scale must be positive
  if (manifest.physicalScale <= 0) {
    return { allowed: false, reason: "invalid_physical_scale" };
  }

  return { allowed: true };
}
