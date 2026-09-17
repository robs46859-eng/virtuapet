"""Strict classic CT subset. Arrays use [slice,row,column]; affine uses [column,row,slice]."""
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import warnings

import numpy as np
import pydicom
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, ImplicitVRLittleEndian


class DicomRejected(ValueError):
    """Stable rejection code; never include input identifiers or parser messages."""


@dataclass(frozen=True)
class Volume:
    voxels_hu: np.ndarray
    affine_lps: np.ndarray
    source_sha256: tuple[str, ...]
    orientation_assumption: str = "BIPED: source anatomy requires reviewer confirmation"

    @property
    def affine_ras(self):
        return np.diag([-1., -1., 1., 1.]) @ self.affine_lps


def require(ok, code):
    if not ok:
        raise DicomRejected(code)


def vector(value, size):
    a = np.asarray(value, dtype=float)
    require(a.shape == (size,) and np.isfinite(a).all(), "invalid_geometry")
    return a


def reconstruct_ct(objects: list[bytes], *, max_input_bytes=64 * 1024 * 1024,
                   max_voxels=16_000_000) -> Volume:
    """Decode bounded, native 16-bit CT instances from trusted local byte buffers.

    Caller must supply a complete approved series. Uniform spacing alone cannot
    detect missing endpoints or a uniformly undersampled acquisition.
    Process/container memory and CPU limits are still required for hostile inputs.
    """
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            return _reconstruct(objects, max_input_bytes, max_voxels)
    except DicomRejected:
        raise
    except Exception:
        raise DicomRejected("invalid_dicom") from None


def _reconstruct(objects, max_input_bytes, max_voxels):
    require(2 <= len(objects) <= 2048, "instance_count_limit")
    require(sum(len(x) for x in objects) <= max_input_bytes, "input_byte_limit")
    datasets = []
    seen = set()
    total = 0
    for blob in objects:
        require(len(blob) >= 132 and blob[128:132] == b"DICM", "part10_required")
        ds = pydicom.dcmread(BytesIO(blob), force=False)
        require(ds.file_meta.TransferSyntaxUID in (ExplicitVRLittleEndian, ImplicitVRLittleEndian),
                "transfer_syntax_unsupported")
        require(ds.SOPClassUID == CTImageStorage and ds.Modality == "CT", "classic_ct_required")
        require(ds.file_meta.MediaStorageSOPClassUID == ds.SOPClassUID and
                ds.file_meta.MediaStorageSOPInstanceUID == ds.SOPInstanceUID, "file_meta_mismatch")
        require(all(str(getattr(ds, k, "")).strip() for k in
                    ("PatientID", "StudyInstanceUID", "SeriesInstanceUID", "FrameOfReferenceUID", "SOPInstanceUID")),
                "identity_required")
        require(ds.SOPInstanceUID not in seen, "duplicate_instance")
        seen.add(ds.SOPInstanceUID)
        require(getattr(ds, "AnatomicalOrientationType", "BIPED") == "BIPED", "quadruped_mapping_required")
        require(int(getattr(ds, "NumberOfFrames", 1)) == 1, "multiframe_unsupported")
        require(ds.SamplesPerPixel == 1 and ds.PhotometricInterpretation == "MONOCHROME2",
                "pixel_layout_unsupported")
        require(ds.BitsAllocated == 16 and 1 <= ds.BitsStored <= 16 and
                ds.HighBit == ds.BitsStored - 1 and ds.PixelRepresentation in (0, 1), "pixel_layout_unsupported")
        require(ds.Rows > 0 and ds.Columns > 0, "invalid_dimensions")
        total += ds.Rows * ds.Columns
        require(total <= max_voxels, "voxel_limit")
        require(len(ds.PixelData) == ds.Rows * ds.Columns * 2, "pixel_length_mismatch")
        require("PixelPaddingValue" not in ds and "ModalityLUTSequence" not in ds,
                "intensity_transform_unsupported")
        require(getattr(ds, "RescaleType", "") == "HU", "hu_units_required")
        slope, intercept = float(ds.RescaleSlope), float(ds.RescaleIntercept)
        require(np.isfinite([slope, intercept]).all() and slope != 0, "invalid_rescale")
        orient = vector(ds.ImageOrientationPatient, 6)
        x, y = orient[:3], orient[3:]
        require(abs(np.linalg.norm(x) - 1) < 1e-6 and abs(np.linalg.norm(y) - 1) < 1e-6
                and abs(np.dot(x, y)) < 1e-6, "invalid_orientation")
        spacing = vector(ds.PixelSpacing, 2)
        require((spacing > 0).all(), "invalid_spacing")
        position = vector(ds.ImagePositionPatient, 3)
        datasets.append((ds, orient, spacing, position, sha256(blob).hexdigest(), slope, intercept))
    first = datasets[0]
    for item in datasets:
        require(all(getattr(item[0], k, None) == getattr(first[0], k, None) for k in
                    ("PatientID", "IssuerOfPatientID", "StudyInstanceUID", "SeriesInstanceUID",
                     "FrameOfReferenceUID", "Rows", "Columns", "Laterality", "ImageLaterality")), "series_mismatch")
        require(np.allclose(item[1], first[1], atol=1e-6, rtol=0) and
                np.allclose(item[2], first[2], atol=1e-6, rtol=0), "inconsistent_geometry")
    normal = np.cross(first[1][:3], first[1][3:])
    datasets.sort(key=lambda d: float(d[3] @ normal))
    positions = np.array([d[3] for d in datasets])
    distances = np.diff(positions @ normal)
    require((distances > 1e-5).all(), "duplicate_plane")
    step = float(np.median(distances))
    require(np.allclose(distances, step, atol=1e-4, rtol=0), "irregular_spacing")
    require(np.allclose(np.diff(positions, axis=0), step * normal, atol=1e-4, rtol=0),
            "gantry_tilt_unsupported")
    affine = np.eye(4)
    affine[:3, 0] = first[1][:3] * first[2][1]
    affine[:3, 1] = first[1][3:] * first[2][0]
    affine[:3, 2] = normal * step
    affine[:3, 3] = positions[0]
    voxels = np.empty((len(datasets), first[0].Rows, first[0].Columns), dtype=np.float32)
    for index, (ds, _, _, _, _, slope, intercept) in enumerate(datasets):
        pixels = ds.pixel_array.astype(np.float64) * slope + intercept
        require(np.isfinite(pixels).all() and (np.abs(pixels) <= np.finfo(np.float32).max).all(),
                "intensity_overflow")
        voxels[index] = pixels
    voxels.setflags(write=False)
    affine.setflags(write=False)
    return Volume(voxels, affine, tuple(d[4] for d in datasets))
