# VirtuaPet Phase 3 Intended Use Specification

## Document Control

| Field | Value |
|---|---|
| Document ID | VP-USE-003 |
| Version | 1.0 |
| Status | Approved Intended Use Definition for Phase 3 Validation |
| System | VirtuaPet Clinical Digital Twin & Rehearsal Service |
| Clinical Scope | Single Narrow Veterinary Indended Use |

## 1. Intended Use Definition

VirtuaPet Clinical Twin is a specialized software application intended to assist licensed veterinary surgeons in the pre-operative 3D visualization, anatomic measurement, osteotomy planning, and virtual surgical rehearsal of **Canine Tibial Plateau Leveling Osteotomy (TPLO)** procedures using volumetric computed tomography (CT) imaging.

The system reconstructs patient-specific 3D anatomical models of the canine stifle joint, calculates anatomical axes, identifies reference landmarks, simulates radial osteotomy cuts and rotational alignment correction, and produces cryptographically signed, entitlement-governed 3D representations for interactive surgical rehearsal in the GibiWorld XR runtime.

## 2. Regulatory and Safety Scope

- **Non-Diagnostic, Non-Autonomous**: The system is a pre-operative planning and surgical rehearsal aid. It is NOT an autonomous surgical navigation or robotic cutting system. It does NOT provide automated primary medical diagnosis.
- **Human Clinical Oversight**: Every reconstructed volume, segmentation, anatomical measurement, and surgical plan requires explicit review and cryptographic sign-off by a licensed veterinarian (`veterinarian` role) prior to rehearsal or clinical use.
- **Prohibition on General Claims**: General-purpose veterinary surgical modeling, soft-tissue deformation, or multi-species automated orthopedic planning are strictly out of scope and prohibited from being claimed.

## 3. Scope and Specifications

### 3.1 Target Species and Population
- **Species**: Canine (*Canis lupus familiaris*).
- **Body Size Groups**:
  - Small: < 15 kg
  - Medium: 15 kg – 30 kg
  - Large: 30.1 kg – 45 kg
  - Giant: > 45 kg
- **Skeletal Maturity**: Skeletally mature dogs with closed proximal tibial physes.

### 3.2 Target Anatomy
- **Joint**: Stifle (articulatio genus).
- **Skeletal Structures**:
  1. Proximal and Diaphyseal Tibia (including intercondylar eminence, tibial plateau, tibial tuberosity, and medial malleolus).
  2. Distal Femur (including medial and lateral condyles, trochlear groove).
  3. Patella.
  4. Proximal Fibula (fibular head).

### 3.3 Imaging Modality & Acquisition Constraints
- **Modality**: Volumetric Helical Computed Tomography (CT).
- **Scan Region**: Stifle joint through distal tibia and tarsus of the affected pelvic limb.
- **Slice Thickness**: $\le 1.5\text{ mm}$ (recommended $\le 1.0\text{ mm}$).
- **Slice Increment**: Exactly equal to slice thickness (contiguous volumetric acquisition; zero gap, zero overlap).
- **Pixel Spacing**: $\le 0.75\text{ mm} \times 0.75\text{ mm}$ in-plane.
- **Reconstruction Kernel**: Standard bone / sharp reconstruction convolution filter.
- **Gantry Tilt**: Strictly $0.0^\circ$ (perpendicular to scanner bore).
- **Hounsfield Units (HU)**: Standard calibrated CT density scale (air = -1000 HU, water = 0 HU, cortical bone $\ge 800\text{ HU}$).
- **Laterality**: Explicitly declared in DICOM header (`PatientLaterality` = `L` or `R`) and confirmed by anatomical marker.

### 3.4 Target Clinical Procedure
- **Procedure**: Tibial Plateau Leveling Osteotomy (TPLO) for treatment of cranial cruciate ligament (CCL) insufficiency / rupture.
- **Planning Tasks**:
  1. Mechanical Axis Determination (proximal intercondylar eminence to center of distal tibiotarsal joint).
  2. Cranial/Caudal Tibial Plateau Alignment & Tibial Plateau Angle (TPA) Calculation.
  3. Radial Saw Blade Size Selection ($18\text{ mm}$, $24\text{ mm}$, $27\text{ mm}$, $30\text{ mm}$, $33\text{ mm}$).
  4. Osteotomy Center and Cut Cylinder Positioning.
  5. Angular Correction and Rotational Chord Distance Calculation to target post-op TPA of $5.0^\circ \pm 1.0^\circ$.
  6. Tibial Tuberosity Thickness / Safe Margin Assessment ($\ge 10.0\text{ mm}$).
  7. Locking TPLO Plate Size and Screw Placement Clearance.

### 3.5 Intended Users
- Board-certified veterinary orthopedic surgeons (DACVS, DECVS) or licensed veterinarians with documented credentialing and practical training in TPLO surgical technique.
- Trained veterinary technicians/radiology staff acting under direct veterinary supervision for ingestion and pre-segmentation preparation.

### 3.6 Clinical Exclusions
1. Skeletally immature dogs with open proximal tibial physes.
2. Active or suspected septic arthritis or osteomyelitis in the target limb.
3. Severe comminuted peri-articular fractures precluding anatomical reference identification.
4. Aggressive osteolytic neoplasms (e.g., osteosarcoma) destroying proximal tibial architecture.
5. Pre-existing metal hardware (plates, pins, total knee components) producing severe beam hardening or scatter artifacts across the proximal tibia.
6. Severe patient motion artifacts exceeding $1.0\text{ mm}$ anatomical blur.

## 4. Specific Clinical Measurements

| Measurement ID | Clinical Name | Method | Normal / Reference Range | Action Limit / Target |
|---|---|---|---|---|
| `MEAS_TPA` | Tibial Plateau Angle | Angle between tibial plateau slope line and perpendicular to mechanical axis | $18^\circ – 34^\circ$ | Target post-op $5^\circ \pm 1^\circ$ |
| `MEAS_BLADE` | Saw Blade Radius | Proximal tibial width vs radial cylindrical saw blade profile | $18, 24, 27, 30, 33\text{ mm}$ | Anatomically matched |
| `MEAS_ROT` | Rotation Chord Distance | Arc length along cylindrical osteotomy cut needed for target TPA reduction | $1.5 – 12.0\text{ mm}$ | Derived from TPA reduction |
| `MEAS_TUB` | Tibial Tuberosity Margin | Shortest distance from planned cut to patellar tendon insertion / tuberosity cortex | $> 12\text{ mm}$ | Hard stop: $\le 10\text{ mm}$ (risk of avulsion fracture) |
| `MEAS_FIB` | Fibula Distance | Distance from osteotomy cut cylinder to proximal fibular head | $> 2.0\text{ mm}$ | Clearance warning |

## 5. Procedure-Specific Accuracy and Quality Thresholds

These procedure-specific thresholds equal or exceed the cross-cutting platform standards:

1. **Integrity & Orientation**:
   - Patient ID, Study UID, Series UID, and Laterality preservation: $100\%$.
   - Patient or laterality mismatches: Exactly $0\%$.
   - Units (HU, mm) and coordinate frame (DICOM LPS) preservation: $100\%$.
2. **Traceability**:
   - Source DICOM instance to 3D rendered facet traceability: $100\%$.
   - Complete parent-child lineage and cryptographic provenance: $100\%$.
3. **Clinical Sign-Off**:
   - Unapproved models entering rehearsal: Exactly $0\%$.
   - Veterinarian approval required before GibiWorld packaging: $100\%$.
4. **Geometric Accuracy**:
   - Approved linear measurements within $1.5\text{ mm}$ or $2.5\%$ (stricter than cross-cutting $2.0\text{ mm} / 3\%$): $\ge 95\%$.
   - Approved angular measurements (TPA) within $1.0^\circ$: $\ge 95\%$.
   - Critical surface 95th-percentile Hausdorff distance (HD95) $\le 1.5\text{ mm}$ (stricter than cross-cutting $2.0\text{ mm}$): $\ge 95\%$.
   - Structure-specific Dice Similarity Coefficient (DSC):
     - Proximal Tibia: $\text{DSC} \ge 0.92$
     - Distal Femur: $\text{DSC} \ge 0.90$
     - Patella: $\text{DSC} \ge 0.88$
5. **Topology & Manifold Quality**:
   - Watertight, 2-manifold triangular meshes with zero non-manifold edges or vertices: $100\%$.
6. **Usability & Rehearsal**:
   - Unassisted rehearsal task completion: $\ge 90\%$.
   - System Usability Scale (SUS): Median $\ge 80 / 100$.
7. **Subgroup Performance**:
   - Zero hidden subgroup failure across body size, scanner make, or pathology.
