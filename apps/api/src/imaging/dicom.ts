import { createHash } from "node:crypto";

export interface QuarantineResult {
  isSafe: boolean;
  reason?: string;
  fileSizeBytes: number;
  detectedMime: string;
}

export interface DicomInstanceMetadata {
  sopInstanceUid: string;
  sopClassUid?: string;
  patientId: string;
  patientName?: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  modality: string;
  laterality?: "L" | "R";
  sliceThickness: number;
  pixelSpacing: [number, number];
  imageOrientationPatient: [number, number, number, number, number, number];
  imagePositionPatient: [number, number, number];
  rows: number;
  columns: number;
  instanceNumber: number;
  rescaleIntercept?: number;
  rescaleSlope?: number;
}

const PE_MAGIC = Buffer.from([0x4D, 0x5A]);
const ELF_MAGIC = Buffer.from([0x7F, 0x45, 0x4C, 0x46]);
const MACHO_32 = Buffer.from([0xFE, 0xED, 0xFA, 0xCE]);
const MACHO_64 = Buffer.from([0xFE, 0xED, 0xFA, 0xCF]);
const MACHO_FAT = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]);

export function inspectFileQuarantine(fileBuffer: Buffer, fileName: string): QuarantineResult {
  const size = fileBuffer.length;
  if (size > 100 * 1024 * 1024) {
    return { isSafe: false, reason: "file_size_exceeds_limit_100mb", fileSizeBytes: size, detectedMime: "application/octet-stream" };
  }
  if (size < 132) {
    return { isSafe: false, reason: "file_too_small_for_valid_dicom", fileSizeBytes: size, detectedMime: "application/octet-stream" };
  }
  if (fileBuffer.subarray(0, 2).equals(PE_MAGIC)) {
    return { isSafe: false, reason: "executable_pe_binary_rejected", fileSizeBytes: size, detectedMime: "application/x-dosexec" };
  }
  if (fileBuffer.subarray(0, 4).equals(ELF_MAGIC)) {
    return { isSafe: false, reason: "executable_elf_binary_rejected", fileSizeBytes: size, detectedMime: "application/x-executable" };
  }
  if (fileBuffer.subarray(0, 4).equals(MACHO_32) || fileBuffer.subarray(0, 4).equals(MACHO_64) || fileBuffer.subarray(0, 4).equals(MACHO_FAT)) {
    return { isSafe: false, reason: "executable_macho_binary_rejected", fileSizeBytes: size, detectedMime: "application/x-mach-binary" };
  }
  if (fileName.includes("..") || fileName.startsWith("/") || fileName.includes("\\")) {
    return { isSafe: false, reason: "path_traversal_in_filename", fileSizeBytes: size, detectedMime: "application/octet-stream" };
  }
  const dicmPreamble = fileBuffer.subarray(128, 132).toString("ascii");
  if (dicmPreamble === "DICM") {
    return { isSafe: true, fileSizeBytes: size, detectedMime: "application/dicom" };
  }
  try {
    const textSample = fileBuffer.subarray(0, Math.min(size, 4096)).toString("utf8");
    if (textSample.trim().startsWith("{") && textSample.includes("sopInstanceUid")) {
      return { isSafe: true, fileSizeBytes: size, detectedMime: "application/json+dicom" };
    }
  } catch {}
  return { isSafe: false, reason: "missing_dicom_preamble", fileSizeBytes: size, detectedMime: "application/octet-stream" };
}

export function deidentifyDicom(instance: DicomInstanceMetadata, salt: string = "virtuapet_deid_v1"): DicomInstanceMetadata {
  const patientHash = createHash("sha256").update(instance.patientId + salt).digest("hex").slice(0, 16).toUpperCase();
  return {
    ...instance,
    patientId: "ANON-CANINE-" + patientHash,
    patientName: "ANONYMIZED^CANINE^" + patientHash
  };
}

export interface ValidationFailure {
  field: string;
  reason: string;
}

export function validateDicomSeries(instances: DicomInstanceMetadata[], expectedLaterality?: "L" | "R"): { valid: boolean; failures: ValidationFailure[] } {
  const failures: ValidationFailure[] = [];

  if (instances.length < 5) {
    failures.push({ field: "sliceCount", reason: "insufficient_slices_for_3d_volume: got " + instances.length + ", minimum required is 5" });
    return { valid: false, failures };
  }

  const first = instances[0];
  if (!first) {
    return { valid: false, failures: [{ field: "instances", reason: "empty_instances" }] };
  }

  const expectedStudyUid = first.studyInstanceUid;
  const expectedSeriesUid = first.seriesInstanceUid;
  const expectedPatientId = first.patientId;
  const expectedModality = first.modality;
  const seriesLaterality = first.laterality;

  if (expectedModality !== "CT") {
    failures.push({ field: "modality", reason: "unsupported_modality: expected CT, got " + expectedModality });
  }

  if (!seriesLaterality || !["L", "R"].includes(seriesLaterality)) {
    failures.push({ field: "laterality", reason: "invalid_laterality: expected L or R, got " + seriesLaterality });
  }

  if (expectedLaterality && seriesLaterality !== expectedLaterality) {
    failures.push({ field: "laterality", reason: "laterality_mismatch: expected " + expectedLaterality + ", got " + seriesLaterality });
  }

  if (first.sliceThickness <= 0 || first.sliceThickness > 1.5) {
    failures.push({ field: "sliceThickness", reason: "slice_thickness_out_of_range: got " + first.sliceThickness + " mm, limit is <= 1.5 mm" });
  }

  const px0 = first.pixelSpacing[0] ?? 0;
  const px1 = first.pixelSpacing[1] ?? 0;
  if (px0 <= 0 || px0 > 0.75 || px1 <= 0 || px1 > 0.75) {
    failures.push({ field: "pixelSpacing", reason: "pixel_spacing_exceeds_limit_0.75mm: got [" + px0 + ", " + px1 + "]" });
  }

  const iop = first.imageOrientationPatient;
  const r = [iop[0] ?? 0, iop[1] ?? 0, iop[2] ?? 0] as const;
  const c = [iop[3] ?? 0, iop[4] ?? 0, iop[5] ?? 0] as const;
  const rNorm = Math.hypot(r[0], r[1], r[2]);
  const cNorm = Math.hypot(c[0], c[1], c[2]);
  const dot = r[0] * c[0] + r[1] * c[1] + r[2] * c[2];

  if (Math.abs(rNorm - 1.0) > 0.01 || Math.abs(cNorm - 1.0) > 0.01) {
    failures.push({ field: "imageOrientationPatient", reason: "orientation_vectors_not_unit_length" });
  }
  if (Math.abs(dot) > 0.01) {
    failures.push({ field: "imageOrientationPatient", reason: "orientation_vectors_not_orthogonal" });
  }

  const n: [number, number, number] = [
    r[1] * c[2] - r[2] * c[1],
    r[2] * c[0] - r[0] * c[2],
    r[0] * c[1] - r[1] * c[0]
  ];

  const sorted = [...instances].sort((a, b) => {
    const posA = (a.imagePositionPatient[0] ?? 0) * n[0] + (a.imagePositionPatient[1] ?? 0) * n[1] + (a.imagePositionPatient[2] ?? 0) * n[2];
    const posB = (b.imagePositionPatient[0] ?? 0) * n[0] + (b.imagePositionPatient[1] ?? 0) * n[1] + (b.imagePositionPatient[2] ?? 0) * n[2];
    return posA - posB;
  });

  for (let i = 0; i < sorted.length; i++) {
    const inst = sorted[i];
    if (!inst) continue;
    if (inst.studyInstanceUid !== expectedStudyUid) {
      failures.push({ field: "studyInstanceUid", reason: "heterogeneous_study_detected_at_slice_" + i });
    }
    if (inst.seriesInstanceUid !== expectedSeriesUid) {
      failures.push({ field: "seriesInstanceUid", reason: "heterogeneous_series_detected_at_slice_" + i });
    }
    if (inst.patientId !== expectedPatientId) {
      failures.push({ field: "patientId", reason: "patient_mismatch_detected_at_slice_" + i });
    }
    if (inst.laterality !== seriesLaterality) {
      failures.push({ field: "laterality", reason: "laterality_inversion_detected_at_slice_" + i });
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev) {
        const prevDist = (prev.imagePositionPatient[0] ?? 0) * n[0] + (prev.imagePositionPatient[1] ?? 0) * n[1] + (prev.imagePositionPatient[2] ?? 0) * n[2];
        const curDist = (inst.imagePositionPatient[0] ?? 0) * n[0] + (inst.imagePositionPatient[1] ?? 0) * n[1] + (inst.imagePositionPatient[2] ?? 0) * n[2];
        const deltaZ = Math.abs(curDist - prevDist);

        if (Math.abs(deltaZ - first.sliceThickness) > 0.05) {
          failures.push({ field: "sliceSpacing", reason: "non_contiguous_slices_at_index_" + i + ": gap=" + deltaZ.toFixed(3) + "mm, expected=" + first.sliceThickness + "mm" });
        }
      }
    }
  }

  return { valid: failures.length === 0, failures };
}

export function computeInstanceHash(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
