# VirtuaPet Anatomical Twin, Clinical Digital Twin, Surgical Planning and PSI Architecture

**Document ID:** VP-ARCH-CDT-001
**Version:** 2.0
**Date:** September 16, 2026
**Status:** Development specification and validation baseline
**Product surface:** VirtuaPet VetOS Intelligence and Command tiers
**Clinical boundary:** Planning, rehearsal, and controlled PSI-design aid only; not autonomous diagnosis, robotic control, guaranteed fit, or intraoperative navigation

## 1. Purpose

This specification defines how VirtuaPet VetOS will turn veterinary DICOM studies into an interactive patient-specific anatomical twin, then combine approved PIMS, laboratory, and longitudinal health evidence into versioned clinical digital-twin snapshots for review, measurement, surgical planning, virtual rehearsal, and controlled patient-specific instrument (PSI) design.

The first target studies are CT and MR series. The first target procedures are orthopedic and other structure-focused cases in which the anatomy can be segmented and checked clearly. Each generated anatomical twin remains linked to its source images, source series, processing version, reviewer, and approval state. Each digital-twin snapshot also identifies the exact PIMS encounters, lab results, medications, procedures, observations, and effective times used to provide clinical context.

The service is in development. A model cannot be used for clinical rehearsal until it passes the technical gates in this document and a licensed veterinarian approves the relevant anatomy.

## 2. Product Promise and Limits

The service will help a veterinary team:

- import an imaging study from an approved PACS or file upload;
- confirm patient, study, series, spacing, orientation, and image integrity;
- separate selected anatomy into labeled structures;
- create a patient-specific 3D surface model;
- compare the 3D model directly with the original image slices;
- measure distances, angles, volumes, and planned paths;
- place virtual implants or procedure guides from approved libraries;
- compare the plan with current problems, medications, allergies, laboratory status, prior procedures, healing progress, and longitudinal outcomes;
- rehearse viewpoints, access paths, reductions, resections, and placements;
- generate a controlled PSI design candidate from the approved clinical geometry and plan;
- share a controlled case with another veterinarian;
- open the approved twin in a desktop, tablet, headset, or AR experience;
- record the plan, reviewer decisions, uncertainties, and final approval.

The service will not:

- decide whether surgery is needed;
- choose a procedure without a veterinarian;
- replace the radiology interpretation or original DICOM images;
- claim that an automatically segmented structure is correct before review;
- control a robot, surgical tool, implant, or anesthesia device;
- provide intraoperative navigation under this release;
- guarantee surgical results;
- guarantee implant or PSI fit;
- release a PSI without engineering, manufacturing, dimensional, sterilization, and surgeon approvals;
- hide a failed quality check behind a visually smooth model.

## 3. Standards Baseline

VirtuaPet will preserve the DICOM study as the clinical source of truth. The pipeline will use DICOM objects and identifiers throughout ingestion, processing, review, and export.

Required standards support includes:

- DICOM PS3.3 image information objects;
- DICOM Segmentation objects for voxel or label-map segmentations when supported;
- DICOM Surface Segmentation objects for polygonal surfaces when supported;
- DICOM Spatial Registration when a derived object is mapped to another frame of reference;
- DICOM Structured Reporting for measurements and review results where supported;
- DICOMweb QIDO-RS, WADO-RS, and STOW-RS for query, retrieval, and storage;
- DICOM PS3.15 confidentiality profiles for approved de-identification workflows;
- lossless source preservation and cryptographic checksums.

The DICOM standard defines Surface Segmentation as a polygonal representation of a three-dimensional surface and uses the Frame of Reference UID to preserve the coordinate system. It also notes that applications may still need the referenced images for acquisition details. That is why VirtuaPet must never detach the twin from its source study. See the [DICOM Surface Segmentation IOD](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.57.html) and the [current DICOM standard](https://dicom.nema.org/medical/dicom/current/output/chtml/part01/ps3.1.html).

## 4. System Context

```text
Clinic PACS or Secure Upload
        |
        v
DICOM Ingestion Gateway
        |
        +--> Malware and file quarantine
        +--> DICOM conformance and identity checks
        +--> Source checksum and immutable archive
        |
        v
Study Normalization Service
        |
        +--> Series selection
        +--> Orientation and spacing validation
        +--> Modality-specific preprocessing
        |
        v
Segmentation Orchestrator
        |
        +--> Approved model inference
        +--> Confidence and uncertainty maps
        +--> Manual correction workspace
        |
        v
Geometry and Twin Builder
        |
        +--> Voxel labels
        +--> Surface meshes
        +--> Measurements and landmarks
        +--> glTF or USDZ rehearsal asset
        +--> Approved anatomical-twin version
        |
        +<-- PIMS encounters, diagnoses, procedures, medications, allergies
        +<-- Lab/pathology results, units, reference ranges, corrections
        +<-- Longitudinal vitals, rehabilitation, outcomes, observations
        |
        v
Clinical Digital Twin Snapshot Builder
        |
        +--> Exact effective-time and source-version manifest
        +--> Surgical planning context
        |
        v
Veterinary Review and Approval
        |
        +--> Source-slice overlay
        +--> Structure-by-structure signoff
        +--> Rejection and correction loop
        |
        v
Desktop 3D Viewer, AR Rehearsal, Case Conference, PSI Candidate, or Controlled Export
```

## 5. Core Services

### 5.1 DICOM Ingestion Gateway

The gateway accepts DICOMweb connections, approved PACS transfers, or encrypted uploads. It creates a job only after the file set passes quarantine.

It records:

- tenant, clinic, patient, and case identifiers;
- Study Instance UID, Series Instance UID, SOP Instance UID, and Frame of Reference UID;
- modality, body region, species, acquisition date, slice thickness, pixel spacing, orientation, and image dimensions;
- transfer syntax and compression method;
- source file count and expected instance count;
- SHA-256 checksum for every object;
- uploader, source system, time, and purpose;
- whether identifiers are retained for clinical care or removed for research and demonstration.

The gateway must reject or quarantine duplicate SOP Instance UIDs with different bytes, missing geometry needed for reconstruction, unsupported compressed objects, inconsistent patient identity, or mixed frames of reference that have no valid registration.

### 5.2 Study Normalization Service

The service groups files into valid series, orders slices from DICOM geometry rather than filenames, and converts pixel values without changing the source archive.

It must:

- use Image Position Patient and Image Orientation Patient when present;
- respect pixel spacing and slice spacing;
- apply rescale slope and intercept where required;
- preserve signed pixel values and modality units;
- detect gantry tilt, gaps, duplicates, reversed order, and nonuniform spacing;
- identify localizer or scout views and exclude them from a 3D volume by default;
- retain a reversible map from every derived voxel to the source object and frame.

### 5.3 Segmentation Orchestrator

The orchestrator selects only a model approved for the study's species, modality, body region, and acquisition range. It must not silently use a canine model for a feline case or use an orthopedic model outside its validated anatomy.

Each output includes:

- structure name and controlled terminology code;
- binary or fractional voxel mask;
- per-voxel or per-region confidence where available;
- model name, version, training-data declaration, and validation scope;
- preprocessing and postprocessing versions;
- known limitations;
- manual edits and editor identity;
- approval status for each structure.

Low-confidence regions are shown to the reviewer. They are not smoothed away or presented as certain.

### 5.4 Geometry and Twin Builder

The builder creates a surface only after a valid voxel segmentation exists. Surface generation must preserve the patient coordinate frame.

The builder performs:

- label cleanup with recorded parameters;
- topology checks;
- marching-cubes or equivalent surface extraction;
- unit conversion to millimeters;
- surface smoothing limited by the allowed geometric-error budget;
- mesh decimation limited by the same error budget;
- normal repair and non-manifold detection;
- connected-component review;
- glTF or USDZ packaging for interactive use;
- DICOM segmentation or surface export when the receiving system supports it.

The production model stores both the high-resolution clinical mesh and a separate display mesh. A lighter AR mesh cannot overwrite or become the measurement source.

### 5.5 Surgical Rehearsal Workspace

The workspace provides synchronized 2D and 3D views. Selecting a point on the model shows the related source slices. Selecting a source slice updates the 3D crosshair.

Tools include:

- window and level controls;
- axial, sagittal, coronal, and oblique views;
- structure show, hide, isolate, color, and transparency controls;
- distance, angle, centerline, diameter, and volume measurements;
- landmarks and named target points;
- clipping planes and cut simulations;
- virtual reduction or repositioning of selected structures;
- implant template placement from versioned libraries;
- approach-path and collision visualization;
- before-and-after plan states;
- annotations, screenshots, and narrated case review;
- an AR scale check before the model can be shown at 1:1 size.

Every measurement must state whether it came from the source volume, clinical mesh, or display mesh. Measurements for clinical planning come from the source volume or approved clinical mesh only.

### 5.6 AR Delivery Through GibiWorld

GibiWorld supplies the Unity spatial runtime. Clinical rehearsal runs in a separate protected workspace from consumer entertainment features.

The AR client must:

- verify the case approval token and asset checksum;
- show patient, case, laterality, anatomy, model version, and approval status;
- require a physical scale calibration before 1:1 display;
- display a visible scale bar and coordinate axes;
- prevent accidental mirror reflection or left-right reversal;
- allow reset to the approved reference pose;
- record device, software version, tracking state, and session time;
- warn when tracking quality, lighting, or scale confidence is outside limits;
- disable measurement and implant-fit claims when the device is not in a validated mode.

### 5.7 PIMS, Laboratory, and Longitudinal Health Context

The clinical-context gateway reads approved source data through vendor APIs, standards-based interfaces, or clinic-authorized exports. It does not write back to a PIMS or laboratory system unless a separately approved contract defines conflict handling, idempotency, attribution, and rollback.

Every normalized item carries:

- VirtuaPet tenant, patient, and pet identifiers;
- source system, source organization, source record identifier, and source version;
- author or ordering clinician when available;
- observed, collected, resulted, corrected, entered, and effective timestamps as applicable;
- status such as preliminary, final, corrected, cancelled, entered-in-error, or unknown;
- code system, local code, normalized code, display text, value, unit, reference range, abnormal flag, and interpretation for laboratory data;
- provenance checksum, retrieval time, mapping version, and confidence or unresolved mapping state;
- consent purpose and access boundary.

Identity resolution uses server-owned mappings and clinic confirmation for ambiguity. Names alone are never sufficient. Preliminary or corrected results remain visibly labeled. A corrected or cancelled result supersedes but does not erase its prior version. Unsupported units or uncertain code mappings are shown as unresolved and excluded from automated planning rules.

The snapshot builder uses an effective-time query. A rehearsal or PSI design references an immutable snapshot containing the exact input record versions used. New PIMS or lab information creates a new candidate snapshot and may invalidate the plan according to veterinarian-defined rules; it never silently changes an approved plan.

### 5.8 Patient-Specific Instrument Design Boundary

The PSI service begins only from an approved anatomical-twin version and an approved surgical plan. It may create guides, drill/saw constraints, contact surfaces, labels, and manufacturing files for a procedure that has a locked validation protocol.

Required controls include:

- clinical geometry and display geometry stored in separate namespaces;
- contact surfaces derived only from approved clinical geometry;
- minimum contact area, clearance, wall thickness, access, collision, and fixation rules defined per procedure;
- deterministic design inputs and reproducible toolchain versions;
- independent engineering review and veterinarian/surgeon review;
- manufacturing process, material, printer/machine, orientation, post-processing, cleaning, sterilization, packaging, and shelf-life records;
- dimensional inspection against the released master and recorded measurement uncertainty;
- unique device or instrument identifier, patient/case label, laterality, revision, use-by rule, and chain of custody;
- quarantine after any geometry, plan, manufacturing, inspection, labeling, or sterility failure.

The released manufacturing master is immutable. Any change creates a new design version and invalidates prior approval. Receipt by the clinic requires condition, label, revision, dimensional-certificate, and case/laterality confirmation before the instrument becomes available for use.

## 6. Case States and Human Approval

```text
RECEIVED
  -> QUARANTINED
  -> VALIDATED
  -> PROCESSING
  -> AUTOMATED_DRAFT
  -> CLINICIAN_REVIEW
  -> CORRECTION_REQUIRED
  -> CLINICIAN_APPROVED
  -> REHEARSAL_READY
  -> PSI_DRAFT
  -> PSI_ENGINEERING_REVIEW
  -> PSI_CLINICAL_REVIEW
  -> PSI_MANUFACTURING_VALIDATION
  -> PSI_RELEASED or PSI_REJECTED
  -> SUPERSEDED or ARCHIVED
```

Only `CLINICIAN_APPROVED` cases can become `REHEARSAL_READY`. Any change to the source series, segmentation, clinical mesh, implant library, or material measurement invalidates approval and creates a new version.

Required approval fields are:

- approving veterinarian;
- professional role and clinic;
- approved structures;
- excluded or uncertain structures;
- intended rehearsal purpose;
- laterality confirmation;
- source series confirmation;
- date and electronic signature;
- next review or expiration rule.

## 7. Data Model and Provenance

The clinical twin must be reproducible. It is not enough to store only the final mesh.

### 7.1 Core Records

| Record | Required responsibility |
|---|---|
| `imaging_study` | Clinic, patient, Study Instance UID, modality, body region, source system, acquisition time, checksum manifest, and retention policy |
| `imaging_series` | Series Instance UID, Frame of Reference UID, image count, spacing, orientation, transfer syntax, eligibility result, and rejection reasons |
| `source_instance` | SOP Instance UID, object checksum, frame count, storage key, and quarantine state |
| `segmentation_job` | Requested structures, model and version, compute environment, inputs, outputs, timing, status, and error |
| `segment_version` | Structure code, source series, voxel mask, confidence data, manual changes, and approval state |
| `clinical_mesh_version` | Source segment version, extraction parameters, topology report, surface checks, checksum, and measurement eligibility |
| `display_mesh_version` | Source clinical mesh, decimation settings, deviation report, device profile, and checksum |
| `landmark_set` | Named landmarks, coordinates, coordinate frame, creator, method, and review state |
| `rehearsal_plan` | Procedure type, approved anatomy versions, measurements, virtual cuts, implant templates, approach paths, notes, and state |
| `clinical_approval` | Approver, approved items, intended use, exceptions, laterality, signature, and time |
| `validation_result` | Metric definition, dataset version, anatomy scope, result, confidence interval, threshold, and pass or fail |
| `rehearsal_session` | User, device, software, plan version, tracking quality, scale result, duration, and exported artifacts |
| `clinical_source_record` | PIMS/lab source, source ID/version, effective time, status, code, value, unit, range, provenance, and mapping state |
| `digital_twin_snapshot` | Anatomical-twin version plus immutable list of clinical source record versions and effective time |
| `psi_design_version` | Plan, approved clinical geometry, procedure rules, contact surfaces, parameters, software/toolchain, and review state |
| `psi_manufacturing_lot` | Released master, manufacturer, process, material, machine, post-processing, sterilization, labels, and custody |
| `psi_inspection` | Dimensional results, uncertainty, deviations, disposition, inspector, and certificates |

All derived records are append-only versions. A correction creates a new version and preserves the earlier record. A display mesh references one clinical mesh; a clinical mesh references one segment version; a segment version references one or more source series.

### 7.2 Provenance Manifest

Every rehearsal-ready package contains a machine-readable manifest:

```json
{
  "caseId": "case_01J...",
  "patientId": "pet_771b...",
  "studyInstanceUid": "1.2.840...",
  "seriesInstanceUids": ["1.2.840..."],
  "frameOfReferenceUid": "1.2.840...",
  "sourceManifestSha256": "...",
  "segmentVersions": [{"structure": "femur", "version": 3, "sha256": "..."}],
  "clinicalMeshVersions": [{"structure": "femur", "version": 2, "sha256": "..."}],
  "displayMeshVersions": [{"deviceProfile": "quest-clinical-v1", "version": 1, "sha256": "..."}],
  "coordinateUnit": "mm",
  "laterality": "LEFT",
  "intendedUseClass": "V3_VIRTUAL_REHEARSAL",
  "approvalId": "approval_01J...",
  "approvedAt": "2026-09-13T20:00:00Z"
}
```

The client verifies the manifest and referenced checksums before opening a case.

## 8. API and Event Contracts

### 8.1 Main API Endpoints

| Method and path | Purpose | Required role |
|---|---|---|
| `POST /v1/clinical-twins/studies` | Create an upload or DICOMweb import session | Imaging staff or veterinarian |
| `GET /v1/clinical-twins/studies/{id}` | Read study validation and eligibility | Approved case user |
| `POST /v1/clinical-twins/studies/{id}/process` | Request a supported segmentation job | Veterinarian or imaging staff |
| `GET /v1/clinical-twins/jobs/{id}` | Read progress, warnings, and failures | Approved case user |
| `POST /v1/clinical-twins/segments/{id}/corrections` | Save a manual correction as a new version | Authorized clinical editor |
| `POST /v1/clinical-twins/cases/{id}/approvals` | Approve named structures and intended use | Licensed veterinarian |
| `POST /v1/clinical-twins/cases/{id}/plans` | Create a rehearsal plan version | Licensed veterinarian |
| `POST /v1/clinical-twins/cases/{id}/snapshots` | Freeze anatomical, PIMS, lab, and longitudinal inputs at an effective time | Licensed veterinarian or approved clinical editor |
| `POST /v1/clinical-twins/plans/{id}/rehearsal-token` | Mint a short-lived, device-bound AR token | Approved plan participant |
| `POST /v1/clinical-twins/plans/{id}/psi-designs` | Create a PSI candidate from released geometry and plan | Licensed veterinarian with PSI permission |
| `POST /v1/clinical-twins/psi-designs/{id}/engineering-review` | Record independent design review | Qualified engineer |
| `POST /v1/clinical-twins/psi-designs/{id}/clinical-review` | Approve intended use, contact, access, and laterality | Licensed veterinarian |
| `POST /v1/clinical-twins/psi-designs/{id}/release` | Release immutable manufacturing master after all gates | Dual-authorized clinical/manufacturing roles |
| `POST /v1/clinical-twins/psi-lots/{id}/inspection` | Record dimensional and receipt inspection | Qualified inspector |
| `GET /v1/clinical-twins/cases/{id}/manifest` | Retrieve signed provenance manifest | Approved plan participant |
| `POST /v1/clinical-twins/cases/{id}/exports` | Request a controlled DICOM or mesh export | Authorized exporter |

Every write accepts an idempotency key. Approval and export endpoints require recent authentication. The API returns structured rejection codes such as `UNSUPPORTED_ANATOMY`, `MISSING_GEOMETRY`, `MIXED_FRAME_OF_REFERENCE`, `LATERALITY_CONFLICT`, `QUALITY_GATE_FAILED`, and `CLINICIAN_APPROVAL_REQUIRED`.

### 8.2 Events

Events are written through the platform outbox and delivered through Azure Service Bus:

- `imaging.study.received`;
- `imaging.study.quarantined`;
- `imaging.study.validated`;
- `clinical_twin.segmentation.completed`;
- `clinical_twin.quality_gate.failed`;
- `clinical_twin.correction.created`;
- `clinical_twin.approved`;
- `clinical_twin.approval.invalidated`;
- `rehearsal.plan.created`;
- `rehearsal.session.completed`;
- `rehearsal.safety_event.reported`.
- `clinical_context.snapshot.created`;
- `clinical_context.source.corrected`;
- `clinical_twin.plan.invalidated`;
- `psi.design.created`;
- `psi.design.released`;
- `psi.manufacturing.quarantined`;
- `psi.instrument.received`.

Events contain tenant, patient, case, correlation, and version identifiers, but no unnecessary image pixels or client contact details.

## 9. Deployment and Runtime Ownership

| Component | Runtime | Data and responsibility |
|---|---|---|
| DICOM gateway | Azure Container App | DICOMweb, uploads, quarantine, identifiers, checksum manifest |
| Normalization worker | Container Apps Job | Volume building, geometry checks, preprocessing |
| Segmentation worker | Isolated CPU or GPU job pool | Approved model inference and uncertainty output |
| Geometry worker | Container Apps Job | Clinical and display meshes, topology and deviation reports |
| Clinical twin API | Container App | Cases, versions, permissions, review, approval, and export |
| Clinical context gateway | Container App + connector workers | PIMS/lab normalization, identity mapping, effective-time snapshots, provenance |
| PSI design service | Isolated job and controlled API | Design candidates, reviews, released masters, manufacturing and inspection evidence |
| Web viewer | VetOS web surface | Source images, overlays, measurements, plan authoring |
| GibiWorld clinical client | Unity application | Protected AR rehearsal and device telemetry |
| PostgreSQL | Azure Database for PostgreSQL | Metadata, states, approvals, measurements, validation results |
| Object storage | Private Azure Blob containers | Source DICOM, masks, meshes, manifests, screenshots, recordings |
| Event bus | Azure Service Bus | Durable job and domain events |
| Key service | Azure Key Vault | Signing keys, encryption keys, and connection secrets |

Source DICOM objects, derived masks, clinical meshes, display meshes, and exports use separate storage prefixes and access policies. Demonstration assets must be de-identified and cannot share a public link with clinical storage.

## 10. Accuracy and Effectiveness Thresholds

The thresholds below are product release gates. They are not claims that the current product already meets them. Each target must be validated separately by species, anatomy, modality, scanner class, acquisition protocol, and intended use.

### 10.1 Tiered Model Use

| Validation class | Permitted use | Minimum evidence |
|---|---|---|
| **V1 Visualization** | Education, case discussion, and anatomy orientation | Technical integrity, source linkage, gross anatomy review, and veterinarian approval |
| **V2 Quantitative Planning** | Measurements and plan comparison | V1 plus structure-specific geometric accuracy, repeatability, and measurement validation |
| **V3 Virtual Rehearsal** | Patient-specific procedure rehearsal and implant-template exploration | V2 plus task-based veterinarian validation, AR scale validation, and procedure-specific hazard review |
| **V4 PSI Candidate** | Procedure-specific patient-contact instrument design and controlled manufacture | V3 plus locked design rules, engineering and surgeon review, qualified material/process, dimensional inspection, sterilization ownership, labeling, and chain of custody |
| **Not included** | Intraoperative navigation, autonomous planning, robotic control, or guaranteed implant fit | Requires a separate regulatory, clinical, and safety program |

### 10.2 Ingestion and Geometry Gates

| Measure | Release threshold | Failure action |
|---|---:|---|
| Required DICOM identifiers and geometry | 100% present or safely derived under a documented rule | Block reconstruction |
| Source object checksum verification | 100% | Quarantine case |
| Instance count reconciliation | 100% or documented known exception | Block automatic processing |
| Slice order, orientation, and laterality checks | 100% pass | Block rehearsal |
| Coordinate transform round-trip error | Maximum 0.5 mm or one-half source voxel, whichever is larger | Block quantitative use |
| Source-to-derived frame consistency | 100% | Block export and AR |
| Left-right reflection tests | Zero unresolved reflections | Block case |
| Clinical-mesh watertightness where required by the procedure | 100% for required structures | Repair or reject |
| Display-mesh deviation from approved clinical mesh | 95th percentile at or below 0.75 mm; maximum at or below 2.0 mm | Regenerate display mesh |

### 10.3 Segmentation Gates

Reference masks must be created or adjudicated by qualified veterinary reviewers. At least two reviewers are required for the validation set, with a documented resolution process for disagreements.

| Structure type | Dice similarity target | 95th percentile Hausdorff distance | Mean surface distance | Volume error |
|---|---:|---:|---:|---:|
| High-contrast bone used for rehearsal | At least 0.95 | At most 2.0 mm | At most 0.75 mm | At most 3% |
| Major soft-tissue organ used for orientation | At least 0.90 | At most 4.0 mm | At most 1.5 mm | At most 5% |
| Vessel, nerve, lesion margin, or other small critical structure | Procedure-specific; Dice alone is insufficient | At most 2.0 mm unless the clinical panel sets a tighter limit | At most 1.0 mm | Procedure-specific |

A model passes only when it meets the required structure's thresholds on the locked external test set and no safety-critical subgroup falls below its procedure-specific floor. Small structures must also pass centerline, landmark, or boundary-distance measures because a high Dice score can hide an unsafe local error.

### 10.4 Landmark and Measurement Gates

| Measure | Release threshold |
|---|---:|
| Target registration error at procedure-critical landmarks | Median at or below 1.0 mm and 95th percentile at or below 2.0 mm |
| Linear measurement absolute error | At or below 1.0 mm for measurements up to 50 mm; otherwise at or below 2% |
| Angular measurement absolute error | At or below 2 degrees |
| Repeated automated measurement variation | Coefficient of variation at or below 2% |
| Inter-reviewer landmark agreement | Intraclass correlation at or above 0.90 for quantitative release |
| 1:1 AR scale error in validated workspace | At or below 2% across the approved viewing volume |
| AR anchor drift during a 20-minute rehearsal | At or below 3 mm translation and 1 degree rotation at the reference target |

If the source voxel size is larger than a stated millimeter limit, the case cannot be represented as meeting that limit. The interface must show the source resolution and downgrade the allowed use.

### 10.5 Clinical Context and Snapshot Gates

| Measure | Release threshold |
|---|---:|
| PIMS/lab source record linked to correct tenant and patient | 100%; ambiguity blocks inclusion |
| Source ID, version, status, and effective-time preservation | 100% |
| Quantitative lab value and unit preservation | 100% exact after parsing; unsupported conversion is not performed |
| Validated normalized unit conversion | 100% agreement with locked conversion fixtures |
| Corrected, cancelled, or entered-in-error result handling | 100% reflected in the next snapshot; obsolete result never labeled current |
| Unresolved code, unit, or reference-range mapping | 100% visibly flagged and excluded from automated planning rules |
| Snapshot reconstruction from declared source versions | 100% byte-identical manifest and semantically identical normalized inputs |
| New safety-relevant source result triggering configured plan review | 100% in the procedure-specific release suite |

These gates measure data integrity, not clinical predictive accuracy. Any claim that longitudinal data improves outcome prediction requires a separate model, intended-use statement, external dataset, calibration analysis, subgroup analysis, and prospective validation.

### 10.6 PSI Design and Manufacturing Gates

| Measure | Release threshold |
|---|---:|
| PSI input geometry from approved clinical mesh | 100%; display mesh use is blocked |
| Patient, case, procedure, and laterality preservation | 100%; zero mismatches |
| Clinical contact-surface deviation from released digital master | Maximum 0.5 mm unless locked procedure validation requires a tighter limit |
| Critical guide axis or slot angular deviation | At most 1.0 degree unless procedure validation requires less |
| Critical guide or slot positional deviation | At most 0.5 mm unless procedure validation requires less |
| Noncritical overall dimensional deviation | At most 1.0 mm or procedure-specific tighter limit |
| Minimum wall, clearance, access, and collision rules | 100% pass against locked procedure rules |
| Engineering review and veterinarian/surgeon release | 100% before manufacturing release |
| Qualified material, process, post-processing, and sterilization path | 100% before manufacturing release |
| Dimensional inspection and certificate reconciliation | 100% before clinic acceptance |
| Receipt check for label, revision, condition, case, and laterality | 100% before available-for-use state |
| Failed or superseded unit quarantined from use | 100% |

### 10.7 Clinical Review and Workflow Effectiveness Gates

| Measure | Pilot threshold |
|---|---:|
| Required-structure approval by veterinary reviewer | 100% before rehearsal |
| Critical anatomy correction rate after approval | Below 1% of released cases; every event triggers review |
| Laterality or patient mismatch | Zero tolerated |
| Veterinarian task completion without assistance | At least 90% for the defined rehearsal tasks |
| Median System Usability Scale score | At least 80 in the target clinical users |
| Plan measurement agreement with approved reference | At least 95% within the applicable measurement tolerance |
| Rehearsal asset load success on supported devices | At least 99.5% |
| Time from validated study to automated draft | 95th percentile at or below 15 minutes for the supported CT profile |
| Time to open an approved rehearsal case | 95th percentile at or below 30 seconds on the supported clinic network |

The pilot must report confidence intervals, failure cases, exclusions, and subgroup results. Average performance alone is not sufficient.

## 11. Validation Dataset Requirements

Before any anatomy or procedure is sold for quantitative planning or rehearsal, the validation set must:

- be separate from training and tuning data;
- include more than one clinic and scanner model;
- cover both canine and feline cases only when both are claimed;
- cover the supported weight and body-size range;
- include normal anatomy, disease, implants, artifacts, and difficult cases;
- include the acquisition protocols allowed in production;
- include low-quality cases used to verify rejection behavior;
- record exclusions and missing data;
- be reviewed under a written annotation manual;
- include double review for critical structures;
- be locked before the final performance run.

No single global accuracy claim is allowed. The release register must name the validated combination, such as `canine pelvic CT bone segmentation V2`, and list the unsupported combinations.

## 12. Feline Grimace Scale Integration

VirtuaPet VetOS will add a structured Feline Grimace Scale workflow for acute-pain observation before and after procedures. The five action units are ear position, eye narrowing, muzzle tension, whisker position, and head position. Each is scored from 0 to 2 for a total of 0 to 10.

The validated research reported strong correlation with another feline pain scale, good inter-rater reliability, and a threshold above 0.39 on a normalized 0-to-1 score. The official FGS guidance expresses the clinical trigger as a score of at least 4 out of 10 and recommends veterinarian consideration of analgesia, with reassessment in 10 to 15 minutes when the score is 4 and uncertainty remains. See the [original validation study](https://pubmed.ncbi.nlm.nih.gov/31836868/) and the [official Feline Grimace Scale instructions](https://www.felinegrimacescale.com/practice-your-skills).

### 12.1 Workflow

1. Observe the awake cat undisturbed for 30 seconds.
2. Wait if the cat is eating, grooming, or vocalizing.
3. Score all five action units manually.
4. Record context, observer, time, recent sedation, procedure, and analgesia.
5. Show the total and trend.
6. At 4 or more, show a clinician-review prompt; do not issue or administer medicine automatically.
7. When the score is exactly 4 and the clinician is uncertain, offer a 10-to-15-minute reassessment timer.
8. Record the veterinarian's decision and reason.

### 12.2 AI Boundary and Validation Gate

The first release is manual scoring with training images and structured prompts. Automated image scoring is disabled for clinical decisions until a locked veterinary validation study passes all gates.

Any future automated assist must achieve, on an external test set:

- sensitivity of at least 0.95 at the 4-of-10 review threshold;
- specificity of at least 0.85;
- weighted kappa of at least 0.80 against the adjudicated veterinary score;
- mean absolute total-score error at or below 0.75 points;
- threshold disagreement below 5%;
- no tested clinic, coat-color, breed-type, age, or image-quality subgroup with sensitivity below 0.90;
- abstention when the face, action unit, or image quality cannot be scored.

General-purpose chatbots are not permitted as the scoring engine. A 2025 study found that chatbot limits of agreement or bias could cross the analgesia threshold and compromise pain decisions. See the [chatbot agreement study](https://pubmed.ncbi.nlm.nih.gov/41366265/).

## 13. Smart Global Vet Link

Smart Global Vet Link turns an origin address, destination address, route, travel date, species, ownership purpose, and transport method into a traceable checklist of possible pet requirements.

It is a rules and evidence service, not an AI-generated legal answer.

### 13.1 Inputs

- verified origin and destination addresses;
- intermediate borders or transit points;
- travel dates and duration;
- dog, cat, ferret, or other supported species;
- number of animals;
- owner-accompanied, authorized-person, commercial, sale, rescue, or transfer purpose;
- air, road, rail, or sea transport;
- microchip and vaccination dates;
- test, treatment, permit, certificate, and endorsement records;
- veterinarian accreditation and license location where relevant.

### 13.2 Address and Jurisdiction Resolution

The resolver converts each address to a country, first-level region, local authority, coordinates, and time zone. It stores the geocoder result, confidence, boundary version, and user confirmation.

Low-confidence, border, tribal, territorial, military, or special-zone addresses require manual confirmation. The system must not assume that a postal city uniquely identifies the legal jurisdiction.

### 13.3 Rule Sources and Precedence

Every rule must point to an authoritative source, retrieval time, effective date, and reviewer. Initial connectors include:

- USDA APHIS destination and interstate pet-travel pages;
- CDC dog-import requirements;
- U.S. state animal-health authorities;
- European Commission pet-movement rules;
- United Kingdom government pet-travel rules;
- destination-country agriculture or veterinary authorities;
- published airline or carrier requirements;
- clinic-entered local practice rules, clearly labeled as clinic policy.

USDA states that destination states and territories set their own interstate animal-health requirements and advises checking the receiving authority. USDA also states that international requirements vary by destination and can change frequently. See [USDA interstate pet travel](https://www.aphis.usda.gov/pet-travel/state-to-state) and the [USDA international process](https://www.aphis.usda.gov/pet-travel/pet-travel-process-overview). The European Commission and GOV.UK maintain separate official requirements for their jurisdictions; see [EU pet travel rules](https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm) and [Great Britain pet travel rules](https://www.gov.uk/bringing-pet-animals-to-great-britain).

When sources conflict, the system shows the conflict and blocks a green clearance. It does not let an AI choose the more convenient rule.

### 13.4 Rule Output

The output is a dated checklist containing:

- required identity method;
- vaccinations and minimum waiting periods;
- laboratory tests and timing windows;
- parasite or other treatments;
- health certificate form and signing authority;
- government endorsement or import permit;
- carrier-specific documents and crate rules;
- number-of-animal and ownership-purpose exceptions;
- entry point or inspection rules;
- earliest safe completion dates;
- unresolved questions and authority contacts;
- source links and last-verified times.

The user sees `Verified`, `Needs review`, `Conflict`, `Unknown`, or `Expired source`. Only rules confirmed from an authoritative source and still within their review window can be marked `Verified`.

### 13.5 Accuracy and Freshness Gates

| Measure | Release threshold |
|---|---:|
| Address-to-country and first-level jurisdiction accuracy on supported regions | At least 99.5% with zero known border misroutes left unresolved |
| Mandatory-rule recall against expert-authored test itineraries | At least 99% |
| Date and waiting-period calculation accuracy | 100% on the release test suite |
| Source citation coverage | 100% of displayed mandatory rules |
| Rules with effective date and retrieval timestamp | 100% |
| Known-source change detection | Within 24 hours for monitored machine-readable sources; within 7 days for manual sources |
| Expired or unreachable authority source | Automatically downgrade to `Needs review` or `Unknown` |
| High-risk itinerary human review | 100% before clinic signs a final certificate |

The service must tell users to verify requirements for every trip. A veterinarian or responsible official makes the final decision and signs official documents.

## 14. Security and Privacy

Clinical studies, segmentations, models, plans, pain scores, and rehearsal recordings are restricted data.

Required controls include:

- clinic-level row security;
- encryption in transit and at rest;
- private object storage with time-limited links;
- separate clinical and demonstration workspaces;
- least-privilege access by role;
- immutable source checksums;
- complete access, change, export, and approval logs;
- configurable retention and legal hold;
- de-identification for approved research or investor demonstrations;
- no model training from clinic cases without a separate, explicit agreement;
- no public AR link containing patient or client information.

## 15. Required Testing

The release pipeline must include:

- DICOM conformance and malformed-object tests;
- orientation, spacing, laterality, and frame-of-reference tests;
- golden-volume reconstruction tests;
- segmentation performance tests on locked external data;
- surface deviation and decimation tests;
- measurement repeatability tests;
- AR scale, drift, reflection, and occlusion tests;
- patient and tenant isolation tests;
- viewer usability tests with veterinarians;
- failure-mode tests for missing slices, metal artifacts, motion, low resolution, and unsupported anatomy;
- FGS scoring and threshold tests;
- regulatory-rule source, date, jurisdiction, and conflict tests;
- PIMS identity ambiguity, source correction, preliminary-to-final lab transition, units, effective time, and stale-snapshot tests;
- PSI clinical-vs-display geometry separation, review bypass, released-master immutability, dimensional inspection, quarantine, and chain-of-custody tests;
- audit-log and approval invalidation tests.

## 16. Delivery Phases

### Phase 1 Safe Viewer

- CT ingestion and source preservation;
- multiplanar viewer;
- manual segmentation and 3D surface creation;
- veterinarian approval;
- desktop 3D review;
- manual FGS workflow;
- rule-source directory for Smart Global Vet Link.

### Phase 2 Quantitative Planning Pilot

- validated automated bone segmentation for one anatomy and species scope;
- measurements and landmarks;
- implant library sandbox;
- external validation dataset;
- controlled clinic pilot;
- address-based U.S. state and international travel checklists.

### Phase 3 Virtual Rehearsal Pilot

- GibiWorld clinical AR workspace;
- validated scale and tracking mode;
- procedure-specific rehearsal tools;
- multi-user case conference;
- surgeon task study;
- expanded supported anatomy.

### Phase 4 Longitudinal Clinical Context Pilot

- connect approved PIMS and laboratory sources;
- validate patient matching, status and unit preservation, corrected-result handling, and effective-time snapshots;
- measure clinician comprehension and workflow burden;
- enable procedure-specific plan-review triggers without autonomous clinical decisions.

Exit requires all clinical-context gates and clinic-approved operating procedures.

### Phase 5 PSI Design and Manufacturing Pilot

- select one narrow procedure and one qualified manufacturing partner;
- lock contact, clearance, dimensional, material, post-processing, sterilization, labeling, and inspection requirements;
- run digital, bench, and representative anatomical-fit validation before any clinical use;
- validate chain of custody, quarantine, revision, and receipt inspection;
- obtain all required legal, quality, clinical, and manufacturing review.

Exit requires all V4 gates. A successful 3D visualization or rehearsal pilot does not authorize PSI manufacture or use.

### Phase 6 Controlled Commercial Release

- published intended-use statement;
- supported scanner, modality, anatomy, and procedure register;
- formal quality-management and incident process;
- contract and regulatory review;
- service-level monitoring;
- post-release performance and drift review.

## 17. Definition of Done

The offering is ready for a named commercial use only when:

1. the supported use and exclusions are written clearly;
2. the DICOM pipeline passes all integrity gates;
3. the anatomy-specific model passes its locked external validation thresholds;
4. the clinical mesh and AR display remain within the approved error budget;
5. veterinarians complete the required rehearsal tasks at the target rate;
6. every released case requires veterinarian approval;
7. source images remain available and synchronized with the twin;
8. privacy, audit, tenant isolation, and retention controls pass review;
9. legal and regulatory review approves the claims for each sales region;
10. customer-facing material labels the feature accurately as visualization, planning, rehearsal, or controlled PSI design;
11. every digital-twin snapshot reproduces its DICOM, PIMS, laboratory, and longitudinal inputs at the stated effective time;
12. PSI design, manufacture, inspection, sterilization ownership, labeling, receipt, and quarantine controls pass for the named procedure.

Until all applicable conditions are met, the offering remains in development or controlled pilot status.
