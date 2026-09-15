# VirtuaPet Phased Development Plan

## Document control

| Field | Value |
|---|---|
| Document ID | VP-PROD-PLAN-001 |
| Version | 1.0 |
| Status | Approved implementation baseline |
| Product | VirtuaPet |
| Planning horizon | September 2026 through September 2029 |
| Owner | VirtuaPet product and engineering leadership |

## 1. Purpose and delivery rule

This plan turns VirtuaPet into a sequence of testable releases. A feature moves forward only when its evidence gate passes. Prototype screens, simulated data, local tests, installed builds, paid pilots, and deployed production are reported separately.

The order is intentional: establish trusted identity, permissions, records, observability, and release controls before adding clinical planning, autonomous devices, transportation, or automated regulation workflows.

## 2. Product boundaries

VirtuaPet is the commercial platform and website. Stelar, PawPath, Judy, Pawsome3D, GibiWorld, Layer8, Shopify, Stripe, Azure, and Hostinger keep their established names. SugarDaddy.lgbt remains legally and operationally separate, with separate governance, accounting, eligibility data, donor data, and decision systems.

Clinical outputs are decision-support artifacts reviewed by qualified veterinary professionals. They are not diagnoses, autonomous treatment recommendations, or substitutes for source images and professional judgment.

## 3. Phase map

| Phase | Period | Outcome | Release gate |
|---|---|---|---|
| Phase 1 Foundation | Now through 90 days | Trusted platform skeleton and first dashboard | Contracts, isolation tests, CI, threat model, and deployable builds pass |
| Phase 2 Clinic and consumer pilot | Months 4-9 | Pet Profile, VetOS essentials, manual FGS, regulation research pilot | Design-partner acceptance and privacy review pass |
| Phase 3 Clinical twin validation | Months 7-18 | Source-linked DICOM pipeline and first validated planning scope | Accuracy, traceability, clinician review, and safety gates pass |
| Phase 4 Spatial and mobility pilots | Months 13-24 | GibiWorld rehearsal, robot alpha, partner travel corridors | Safety and reliability targets pass |
| Phase 5 Commercial scale | Months 25-36 | Paid tiers and controlled geographic expansion | Retention, margin, compliance, and operational readiness pass |

## 4. Phase 1 Foundation

### 4.1 Objectives

- Establish one repository and repeatable build.
- Define the canonical Pet Profile without centralizing every service database.
- Implement owner-bound access and consent contracts.
- Publish honest capability states in the dashboard.
- Separate health from readiness signals.
- Establish security, event, API, testing, documentation, and deployment conventions.
- Preserve the latest dashboard concept as the common navigation shell.

### 4.2 Delivered in the initial repository

- npm workspace containing API, web, and shared contracts.
- Strict pet, consent, and event schemas.
- Protected pet create/read API backed by a development-only repository.
- Owner-isolation behavior that returns not found to unrelated users.
- Capability registry that labels research and discovery work honestly.
- Responsive dashboard shell with no fake customer or clinical records.
- Automated contract and API tests.
- CI workflow, local service definitions, architecture specification, threat model, and handoff.

### 4.3 Remaining Phase 1 work before production

| Workstream | Required result | Acceptance evidence |
|---|---|---|
| Identity | Clerk or approved OIDC verification with issuer, audience, key rotation, and organization mapping | Forged, expired, wrong-audience, and cross-tenant tokens fail |
| Persistence | Azure PostgreSQL repositories and migrations | Backup, restore, migration, concurrency, and row-level isolation tests |
| Layer8 | Signed service-to-service policy decisions and audit correlation | Deny-by-default tests and immutable audit export |
| Billing | Existing Layer8 Stripe entitlement flow connected | Signed webhook replay tests and entitlement reconciliation |
| Web | Authenticated household dashboard and empty states | Keyboard, mobile, accessibility, and browser acceptance |
| Operations | Azure test environment and Hostinger preview | Health, readiness, rollback, secrets, logs, alerts, and recovery evidence |

### 4.4 Phase 1 exit criteria

- No protected endpoint trusts client-supplied authority or tenant membership.
- Every stored object has an owner or organization boundary.
- Every cross-service message has an event ID, correlation ID, schema version, actor, and timestamp.
- Sensitive access is deny-by-default and produces an audit event.
- CI blocks type, test, build, dependency, and secret failures.
- Recovery is exercised, not only documented.
- The dashboard never represents seeded or simulated records as live users.

## 5. Phase 2 Clinic and Consumer Pilot

### 5.1 Consumer foundation

- Household membership and invitations.
- Pet Profile, identity records, health-document vault, emergency summary, and export.
- Time-limited caregiver and clinic grants.
- Pawsome3D asset library and GibiWorld preview.
- Judy travel checklist linked to a pet and trip.

### 5.2 VetOS essentials

- Clinic organization, roles, patient matching, search, calendar, staff schedules, communications, recalls, payment links, and inventory foundation.
- One or two PIMS adapters using a canonical adapter contract.
- No direct cross-service database access.

### 5.3 Manual Feline Grimace Scale

- Five action-unit scoring form.
- Training confirmation and scoring guidance.
- Four-of-ten veterinary-review prompt.
- Reassessment timer and trend view.
- Human-entered values and full audit trail.

Automated camera scoring is excluded until a separately approved study demonstrates species, breed, age, lighting, pose, and site performance.

### 5.4 Smart Global Vet Link pilot

- Normalize an address and resolve jurisdiction.
- Retrieve only approved primary sources.
- Store source URL, authority, retrieval time, effective date when present, and evidence excerpt.
- Generate a draft checklist with unresolved conflicts shown.
- Require human verification before travel or compliance use.

### 5.5 Exit criteria

- At least three design-partner clinics complete representative workflows.
- No unresolved critical privacy or tenant-isolation finding.
- Manual FGS workflow is approved by the clinical owner.
- Regulation results have source and freshness evidence; unsupported answers fail closed.
- Pilot support cost, onboarding time, weekly use, and satisfaction are measured.

## 6. Phase 3 Clinical Twin Validation

### 6.1 Scope

Build a new medical-imaging service. IFC-oriented BIM code may inform job-control and audit patterns but does not convert DICOM anatomy.

### 6.2 Pipeline

1. Secure DICOM or DICOMweb ingestion.
2. Malware screening, format validation, and quarantine.
3. Patient, study, series, modality, orientation, laterality, spacing, and slice-integrity checks.
4. Controlled de-identification for validation datasets.
5. Immutable source manifest and source hash.
6. Volume reconstruction.
7. Model-assisted segmentation with uncertainty output.
8. Clinician correction and approval.
9. Surface extraction, topology repair, labeling, and units preservation.
10. Quantitative validation against approved references.
11. Signed GLB and clinical manifest generation.
12. GibiWorld rehearsal delivery with rollback and source-image access.

### 6.3 Initial accuracy and effectiveness gates

Thresholds are validation targets, not current performance claims.

| Measure | Initial release target |
|---|---:|
| Patient, study, series, and laterality match | 100% |
| Unit and orientation preservation | 100% |
| Critical surface distance error for approved anatomy | 95th percentile at or below 2 mm, or stricter procedure-specific limit |
| Linear measurement error | 95% within 2 mm or 3%, whichever is greater, unless clinical owner sets a stricter limit |
| Clinician approval before rehearsal | 100% |
| Defined rehearsal tasks completed without assistance | At least 90% |
| System Usability Scale median | At least 80 |
| Traceability from rendered structure to source series and model version | 100% |
| Patient or laterality mismatch | Zero tolerance |

Dice or similar overlap metrics must be defined per anatomy and indication. A single global segmentation score is not sufficient for a release decision.

### 6.4 Exit criteria

- A veterinary clinical lead approves the intended-use statement and validation protocol.
- Independent holdout data meets every procedure-specific threshold.
- Failure and uncertainty are visible to the clinician.
- Source DICOM remains available during planning.
- Every correction, measurement, export, rehearsal, and approval is traceable.

## 7. Phase 4 Spatial and Mobility Pilots

### 7.0 Current engineering status (2026-09-15)

The signed spatial-manifest contract, persistence interfaces, PostgreSQL adapter methods, and migration 004 are implemented and pass local automated checks. Live migration, PostgreSQL-backed API proof, database tenant-isolation testing, backup/restore, GibiWorld integration, and all physical pilots remain open. Phase 4 is therefore active, not closed.

Before broad row-level security is enabled, the API must bind the authenticated user and organization to each database transaction through a server-controlled mechanism. Policies based only on freely client-set custom PostgreSQL settings are not an acceptable security boundary.

### 7.1 GibiWorld rehearsal

- Load only signed and entitled clinical assets.
- Preserve scale, units, axes, labels, laterality, and source version.
- Support desktop, tablet AR, and approved headset modes.
- Record device, model, plan, participants, and rehearsal results.

### 7.2 Pet-assistant robot alpha

- Low, stable, one-floor wheeled platform.
- Remote presence, patrol, docking, and owner-controlled enrichment.
- Local collision, cliff, heat, current, wheel-stall, privacy, and network-loss safeguards.
- No medication dosing, animal restraint, stairs, or exterior-door operation.

Pilot gates include zero serious safety incidents, 99.9% safety-stop success in the defined test suite, 98% collision-free missions in approved layouts, and 95% unaided docking.

### 7.3 Partner travel corridors

- Use vetted partner vehicles before owned fleet investment.
- Capture handler verification, climate, route, rest, water, feeding, medications, custody, emergency route, and incident evidence.
- Drone pilots carry permitted property only through qualified operators. Live-animal drone transportation is excluded.

### 7.4 Phase 4 foundation exit evidence

- Migration 004 applied through the private Azure network with checksum evidence.
- Deployed API proven to use the least-privilege PostgreSQL role.
- Cross-tenant allowed and denied tests executed against PostgreSQL, not only memory fixtures.
- Readiness returns unavailable when the required database or schema is unavailable.
- Point-in-time restore drill succeeds without replacing the active database.
- Signed-manifest tamper, expiry, revocation, entitlement, compatibility, scale, axis, laterality, and rollback tests pass.
- No clinical, headset, robot, travel, drone, or holographic-rendering claim advances beyond its collected evidence.

## 8. Phase 5 Commercial Scale

- Convert validated clinic workflows into paid VetOS tiers.
- Offer surgical rehearsal only for validated intended uses.
- Scale robot manufacturing only after landed cost, reliability, service, return, privacy, and safety gates pass.
- Expand travel corridors only when a repeatable corridor has positive contribution margin and compliant operations.
- Offer spatial displays using the accurate device term: AR, mixed reality, stereoscopic, or light-field. Do not imply true holography unless the hardware produces it.

## 9. Program governance

Each workstream has a named product owner, technical owner, security owner, and—where relevant—clinical or regulatory owner. Release reviews record scope, evidence, open risk, rollback plan, and approval. A missed safety or clinical gate pauses the affected capability without blocking unrelated modules.

## 10. Measures reported every month

- active households and clinics, labeled as live, pilot, or test;
- activation and weekly workflow use;
- onboarding time and support cost;
- consent grants created, expired, and revoked;
- security and privacy incidents;
- clinical cases by intended use and approval state;
- model failure, correction, and processing time;
- travel completion, custody evidence, and welfare incidents;
- robot mission, docking, intervention, and safety-stop performance;
- revenue, direct costs, gross margin, operating expense, and runway.
