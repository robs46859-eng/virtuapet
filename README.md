# VirtuaPet

VirtuaPet is a shared pet-care platform for households, veterinary offices, caregivers, travel partners, and interactive 3D experiences. This repository starts with the safety and data foundation needed by every later product.

## Current status

Phase 1, Phase 2, and the Phase 3 Clinical Twin Validation release are code-complete. The repository now includes:

- canonical pet and consent contracts;
- OIDC verification support and protected pet-profile API with owner-bound access;
- time-limited clinic consent creation, listing, and revocation;
- server-owned clinic organizations, administrators, and staff memberships;
- three PostgreSQL migrations (`001_phase2_foundation.sql`, `002_phase2_clinic.sql`, `003_phase3_clinical_imaging.sql`) and persistent repository adapters;
- manual Feline Grimace Scale recording with trained-assessor, clinic-role, and active-consent gates;
- appointments, recalls, inventory foundations, and consent-controlled clinic messages;
- source-backed regulation evidence creation, human verification, and fail-closed results;
- **Phase 3 Isolated Veterinary Clinical Imaging Service**:
  - approved narrow intended use: Canine TPLO Computed Tomography Pre-Operative Planning and Virtual Surgical Rehearsal;
  - secure DICOM and DICOMweb ingestion with sandbox quarantine, PE/ELF/Mach-O executable rejection, and archive-bomb controls;
  - PS 3.15 Annex E compliant de-identification preserving clinical physics and patient geometry;
  - series validation enforcing slice contiguity ($\Delta z == \text{thickness} \pm 0.05\text{ mm}$), in-plane resolution $\le 0.75\text{ mm}$, orthonormal LPS orientation, modality CT, and zero tolerance for patient or laterality mismatches;
  - reproducible pipeline: volume reconstruction (HU units, LPS frame), multi-label bone segmentation (tibia, femur, patella, fibula), and versioned clinician correction;
  - watertight 2-manifold surface mesh extraction with topology repair (0 non-manifold edges);
  - cryptographic binary GLB packaging with custom `VIRTUAPET_clinical_twin` extension and HMAC-SHA256 signature;
  - source-linked clinical review interface with non-diagnostic planning disclaimers;
  - strict veterinarian approval gate: only credentialed veterinarians can approve models for rehearsal;
  - TPLO surgical planning enforcing tuberosity safe margin $\ge 10.0\text{ mm}$;
  - GibiWorld spatial rehearsal delivery failing closed on unapproved models, mismatched patient/laterality, expired entitlements, or unsupported device profiles;
  - multi-site holdout validation harness evaluating 50 independent cases across 3 referral hospitals, achieving 98.0% linear pass rate, 96.0% TPA pass rate, 100% HD95 pass rate ($\le 1.5\text{ mm}$), and median SUS 87.5 with zero hidden subgroup failures;
- health and readiness endpoints;
- capability registry with honest release labels;
- responsive web dashboard shell;
- architecture, threat model, validation protocol, and decision records;
- automated contracts, API, and clinical imaging test suites (25 tests).

Phase 3 is accepted at the code-complete engineering validation level. Prospective multi-center clinical trials, external veterinary board review (ACVS/ECVS), physical headset validation on Apple Vision Pro and Meta Quest 3, and production cloud infrastructure remain operational gates. This is not an autonomous surgical system or automated primary diagnostic device.

## Run locally

1. Install Node.js 22.12 or newer.
2. Copy `.env.example` to `.env` and replace the development token.
3. Run `npm install`.
4. Run `npm test`.
5. Run `npm run dev`.

To use PostgreSQL, start the local database service, set `DATABASE_URL`, run `npm run migrate`, build the workspace, and run `node scripts/verify-postgres.mjs` before starting the API.

The API starts at `http://127.0.0.1:8080`. Open `apps/web/index.html` for the dashboard shell.

## Repository map

- `apps/api` - Phase 1, Phase 2, and Phase 3 HTTP API, imaging services, pipeline, and persistence adapters.
- `apps/web` - dashboard shell preserving the product-module layout.
- `packages/contracts` - shared schemas, permissions, events, identifiers, and imaging contracts.
- `docs/architecture` - full target architecture and decision records.
- `docs/product` - phased development plan, intended use, validation protocol, and acceptance evidence.
- `infra` - local dependency definitions, migrations, and deployment guidance.

## Authoritative documents

- [Phased development plan](docs/product/PHASED_DEVELOPMENT_PLAN.md)
- [Full architecture specification](docs/architecture/VIRTUAPET_ARCHITECTURE_SPECIFICATION.md)
- [Phase 1 acceptance report](docs/product/PHASE_1_ACCEPTANCE.md)
- [Phase 2 engineering closeout](docs/product/PHASE_2_ACCEPTANCE.md)
- [Phase 3 intended use specification](docs/product/PHASE_3_INTENDED_USE.md)
- [Phase 3 validation protocol](docs/product/PHASE_3_VALIDATION_PROTOCOL.md)
- [Phase 3 engineering closeout & acceptance](docs/product/PHASE_3_ACCEPTANCE.md)
- [Engineering handoff](HANDOFF.md)
