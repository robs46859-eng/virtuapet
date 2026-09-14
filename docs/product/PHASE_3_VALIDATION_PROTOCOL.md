# VirtuaPet Phase 3 Clinical Validation Protocol

> Status: planned external protocol. This repository contains no enrolled patients, participating-hospital evidence, governed representative dataset, or completed clinical results. Its generated 50-record fixture is for software calculation tests only.

## Document Control

| Field | Value |
|---|---|
| Document ID | VP-VAL-003 |
| Version | 1.0 |
| Status | Draft protocol; external clinical and regulatory approval required |
| Intended Use Reference | `docs/product/PHASE_3_INTENDED_USE.md` (Canine TPLO CT) |
| Author | Clinical Safety, Regulatory, and Engineering Teams |

## 1. Objective and Hypothesis

The primary objective of this protocol is to validate that the VirtuaPet Clinical Twin system reliably, accurately, and safely reconstructs patient-specific 3D anatomical models and enables pre-operative surgical planning and virtual rehearsal for Canine Tibial Plateau Leveling Osteotomy (TPLO) procedures.

**Primary Hypothesis**:
The VirtuaPet system reconstructs 3D canine stifle anatomy and computes TPLO surgical planning metrics with geometric fidelity meeting or exceeding pre-established veterinary surgical limits:
- $\ge 95\%$ of linear measurements within $1.5\text{ mm}$ or $2.5\%$ of expert ground truth.
- $\ge 95\%$ of TPA measurements within $1.0^\circ$ of multi-observer veterinary consensus.
- Critical bone surface 95th-percentile Hausdorff Distance (HD95) $\le 1.5\text{ mm}$.
- Zero patient, laterality, unit, or orientation mismatches across all cohorts.
- Rehearsal unassisted task completion rate $\ge 90\%$.
- System Usability Scale (SUS) median score $\ge 80$.

## 2. Dataset Governance and Patient/Site Separation

### 2.1 Governance & Ethics
- All imaging data are acquired from veterinary referral institutions with documented institutional animal care and pet owner informed consent for retrospective secondary research and clinical tool validation.
- All direct human client personal identifiable information (PII) is removed or pseudonymized according to DICOM PS 3.15 Annex E (Basic Application Level Confidentiality Profile).
- Critical animal and clinical metadata are retained: Patient ID (anonymized/hashed), Species, Breed, Age, Weight, Sex, Laterality, Acquisition Date, Scanner Manufacturer/Model, KVP, mA, Slice Thickness, Pixel Spacing.

### 2.2 Strict Cohort Separation
To prevent data contamination and overly optimistic validation:
1. **Patient-Level Isolation**: No patient appears in more than one cohort.
2. **Site-Level Isolation**: The Independent Holdout cohort must be gathered from independent veterinary surgical centers that are completely excluded from model training, calibration, and hyperparameter tuning.
3. **Partition Scheme**:
   - **Training Cohort**: Used for algorithm development and reference template building.
   - **Tuning / Validation Cohort**: Used for threshold tuning, calibration, and parameter optimization.
   - **Independent Clinical Holdout Cohort**: Sealed, held-out dataset evaluated only once for the final validation report. No retraining or post-hoc threshold adjustment is permitted after unblinding.

## 3. Stratification Matrix

The validation dataset must contain balanced representation across relevant biological, technical, and pathological variables:

| Variable | Categories | Minimum Holdout Cases |
|---|---|---|
| **Body Size Group** | Small (<15 kg)<br>Medium (15–30 kg)<br>Large (30.1–45 kg)<br>Giant (>45 kg) | 10<br>15<br>15<br>10 |
| **Scanner Manufacturer** | GE Healthcare<br>Siemens Healthineers<br>Philips Healthcare<br>Canon / Toshiba Medical | 12<br>14<br>12<br>12 |
| **Acquisition Protocol** | Standard Helical Bone (0.75–1.0 mm)<br>High-Resolution Stifle (0.5–0.625 mm)<br>Thick-Slice Upper Limit (1.25–1.5 mm) | 25<br>15<br>10 |
| **Pathology Subgroups** | Acute CCL rupture (mild/no osteophytosis)<br>Chronic CCL rupture (severe osteophytosis / periarticular remodeling)<br>CCL rupture with concurrent tibial varus/valgus deformity | 20<br>20<br>10 |
| **Total Independent Cases** | **Multi-Site Clinical Holdout** | **50 distinct patients** |

## 4. Ground Truth Establishment

Ground truth reference data are generated through independent multi-observer annotation:
1. **Volumetric Segmentation Ground Truth**:
   - Voxel-level ground truth segmentations of Proximal Tibia, Distal Femur, and Patella are created by consensus of two board-certified veterinary radiologists (DACVR/DECVDI). Discrepant voxels are adjudicated by a third senior radiologist.
2. **Landmark & Measurement Ground Truth**:
   - Reference points (intercondylar eminence, center of distal tibial articular surface, cranial and caudal tibial plateau reference points, patellar tendon insertion) are manually marked three times independently by three board-certified veterinary surgeons (DACVS/DECVS). The median coordinate forms the ground-truth standard.
   - Reference TPA is calculated from the consensus landmarks.

## 5. Quantitative Metric Definitions

### 5.1 Volumetric Overlap — Dice Similarity Coefficient (DSC)
$$\text{DSC} = \frac{2 |V_{\text{auto}} \cap V_{\text{ref}}|}{|V_{\text{auto}}| + |V_{\text{ref}}|}$$
Evaluated independently for Tibia, Femur, and Patella.

### 5.2 Surface Accuracy — 95th Percentile Hausdorff Distance (HD95)
$$\text{HD}_{95}(S_{\text{auto}}, S_{\text{ref}}) = \text{95th percentile}_{p \in S_{\text{auto}}} \min_{q \in S_{\text{ref}}} \|p - q\|$$
Measures surface contour deviation in millimeters, excluding extreme outliers.

### 5.3 Landmark Localization Error (LLE)
$$\text{LLE} = \|\mathbf{x}_{\text{auto}} - \mathbf{x}_{\text{ref}}\|_2\text{ (mm)}$$
Evaluated for:
- Intercondylar eminence apex
- Distal tibial mechanical axis center
- Cranial and caudal tibial plateau margin points
- Patellar tendon insertion / tibial tuberosity apex

### 5.4 Measurement Errors
- **TPA Absolute Error**: $|\text{TPA}_{\text{auto}} - \text{TPA}_{\text{ref}}|$ (degrees).
- **Linear Measurement Absolute Error**: $|\text{Dim}_{\text{auto}} - \text{Dim}_{\text{ref}}|$ (mm).
- **Linear Measurement Relative Error**: $\frac{|\text{Dim}_{\text{auto}} - \text{Dim}_{\text{ref}}|}{\text{Dim}_{\text{ref}}} \times 100\%$.

### 5.5 Topology Defects
Count of non-manifold edges, non-manifold vertices, self-intersecting facets, and boundary open holes on exported surface meshes. Must be 0 for all clinical models.

### 5.6 Usability and Rehearsal Performance
- **Clinician Correction Time**: Total seconds required for clinician review and manual adjustments.
- **Approval Rate**: Percentage of processed cases approved without rejection.
- **Unassisted Rehearsal Task Completion Rate**: Percentage of surgical rehearsal steps (landmark verification, cut placement, rotation simulation, tuberosity safety verification, hardware check) completed by veterinary users without platform assistance or crashes.
- **System Usability Scale (SUS)**: Standard 10-item instrument administering a score from 0 to 100.

## 6. Pre-Specified Acceptance Gates

| Gate ID | Criterion | Acceptance Threshold | Failure Action |
|---|---|---|---|
| **GATE-01** | Patient, Study, Series, Laterality Preservation | $100\%$ preservation, $0\%$ mismatch | Hard Stop: Pipeline halt |
| **GATE-02** | Unit & Coordinate Frame Consistency | $100\%$ LPS and millimeter preservation | Hard Stop: Pipeline halt |
| **GATE-03** | Veterinarian Pre-Rehearsal Approval | $100\%$ approved by credentialed vet | Hard Stop: Rehearsal locked |
| **GATE-04** | Linear Measurement Error | $\ge 95\%$ within $1.5\text{ mm}$ or $2.5\%$ | Release Blocker |
| **GATE-05** | Angular Measurement Error (TPA) | $\ge 95\%$ within $1.0^\circ$ | Release Blocker |
| **GATE-06** | Surface Distance (HD95) | Critical surface $\text{HD95} \le 1.5\text{ mm}$ | Release Blocker |
| **GATE-07** | Dice Similarity Coefficient | Tibia $\ge 0.92$, Femur $\ge 0.90$, Patella $\ge 0.88$ | Release Blocker |
| **GATE-08** | Topology Manifoldness | $100\%$ watertight, zero non-manifold edges | Release Blocker |
| **GATE-09** | Rehearsal Task Completion | $\ge 90\%$ unassisted completion | Release Blocker |
| **GATE-10** | System Usability Scale (SUS) | Median $\text{SUS} \ge 80 / 100$ | Release Blocker |
| **GATE-11** | Subgroup Equivalence | No failing subgroup behind aggregate mean | Release Blocker |

## 7. No Hidden Subgroup Rule

Aggregate performance scores across all 50 cases are insufficient on their own. The validation suite must report disaggregated results for every sub-category:
- Body size (Small, Medium, Large, Giant)
- Scanner vendor (GE, Siemens, Philips, Canon)
- Protocol (Standard, High-Res, Thick-Slice)
- Pathology (Acute, Chronic Osteophytosis, Deformity)

If any individual subgroup fails any of GATE-04 through GATE-10, the release is deemed a **Subgroup Failure** and cannot receive validation acceptance.
