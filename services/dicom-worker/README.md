# VirtuaPet DICOM worker foundation

Offline engineering library for real pixel decoding of a strict classic CT subset.
No API, Azure worker, malware scanner, de-identification, segmentation or clinical approval is implemented here.

From the repository root:

```sh
uv sync --project services/dicom-worker --locked
uv run --project services/dicom-worker --locked pytest -q
```

```python
from virtuapet_dicom import reconstruct_ct
volume = reconstruct_ct(source_objects)  # list of Part 10 bytes; keep within a trusted boundary
# volume.voxels_hu: float32 [slice, row, column]
# volume.affine_lps maps [column, row, slice, 1] into patient mm.
# source_sha256 is sorted in geometric slice order; it is not a de-identification guarantee.
```

Supports native explicit/implicit little-endian single-frame CT with 16-bit monochrome pixels and explicit HU rescale. Limits: 2–2048 instances, 64 MiB total input, 16 million voxels. Unsupported compression, multiframe, MR, padding/LUT transforms, quadruped semantics and gantry tilt fail closed. Warnings and parser exceptions become safe rejection codes.

Tests create synthetic files containing actual pixels. They do not establish scanner conformance, privacy compliance or clinical accuracy. Before processing untrusted studies, add process isolation, resource quotas, source completeness review and the D2 security boundary described in [the architecture specification](../../docs/architecture/DICOM_IMPLEMENTATION_SPEC.md).
