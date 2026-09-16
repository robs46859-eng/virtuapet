# VirtuaPet

VirtuaPet is a shared pet-care platform for households, veterinary offices, caregivers, travel partners, and interactive 3D experiences. This repository starts with the safety and data foundation needed by every later product.

## Current status

Phase 1, Phase 2, and the Phase 3 Clinical Twin Validation release are code-complete at their documented engineering levels. The Phase 4 foundation is implemented locally but is not operationally closed. The repository now includes:

- canonical pet and consent contracts;
- OIDC verification support and protected pet-profile API with owner-bound access;
- time-limited clinic consent creation, listing, and revocation;
- server-owned clinic organizations, administrators, and staff memberships;
- four PostgreSQL migrations, including Phase 4 spatial-manifest storage, and persistent repository adapters;
- manual Feline Grimace Scale recording with trained-assessor, clinic-role, and active-consent gates;
- appointments, recalls, inventory foundations, and consent-controlled clinic messages;
- source-backed regulation evidence creation, human verification, and fail-closed results;
- **Phase 3 clinical-twin engineering prototype**:
  - proposed narrow intended use: Canine TPLO Computed Tomography Pre-Operative Planning and Virtual Surgical Rehearsal;
  - metadata-level DICOM checks with file caps, preamble checks, executable rejection, and path-traversal rejection; full pixel decoding and sandboxed DICOMweb ingestion are not implemented;
  - prototype metadata de-identification; formal DICOM PS 3.15 conformance is not yet established;
  - series validation enforcing slice contiguity ($\Delta z == \text{thickness} \pm 0.05\text{ mm}$), in-plane resolution $\le 0.75\text{ mm}$, orthonormal LPS orientation, modality CT, and zero tolerance for patient or laterality mismatches;
  - contracts and placeholder records for volume reconstruction, segmentation, correction lineage, and mesh generation; real voxel processing and measured topology repair remain blocked;
  - prototype GLB metadata packaging and HMAC-SHA256 signing; renderable patient geometry is not yet packaged;
  - source-linked clinical review interface with non-diagnostic planning disclaimers;
  - strict veterinarian approval gate: only credentialed veterinarians can approve models for rehearsal;
  - TPLO surgical planning enforcing tuberosity safe margin $\ge 10.0\text{ mm}$;
  - GibiWorld spatial rehearsal delivery failing closed on unapproved models, mismatched patient/laterality, expired entitlements, or unsupported device profiles;
  - deterministic 50-record synthetic fixtures that test the metric calculations only; they are not patient data, hospital data, usability evidence, or clinical performance evidence;
- health and readiness endpoints;
- capability registry with honest release labels;
- responsive web dashboard shell;
- architecture, threat model, validation protocol, and decision records;
- automated contracts, API, imaging, spatial, and integration suites (215 tests at the latest recorded run);
- default-off Layer8 policy, Pawsome3D preview, and PawPath read adapters, plus server-only GibiWorld preflight;
- server-owned integration membership checks, transaction-local database context, and nine real local PostgreSQL isolation checks;
- six parallel integration CI jobs and CI-gated immutable API image publication;
- a versioned, signed spatial-asset manifest contract with fail-closed signature, checksum, expiry, revocation, entitlement, client-version, unit, axis, laterality, and rollback validation;
- separate migrator, runtime, and read-only PostgreSQL roles with distinct required credentials;
- staging/production readiness that rejects an accidental in-memory repository.

Phase 3 is an engineering prototype with passing code tests. Real DICOM pixel processing, measured segmentation and mesh accuracy, representative retrospective validation, prospective multi-center trials, external veterinary review, physical headset validation, and production infrastructure remain gates. This is not an autonomous surgical system or automated primary diagnostic device.

Phase 4 has passing local tests and build checks. Azure revision `virtuapet-staging-api--a9f4854-http` receives 100% of API traffic, with migrations 001–004 and HTTP health/readiness/startup probes. On 2026-09-15, `api.virtuapet.com` was verified bound with TLS; health/readiness returned 200 and an anonymous protected request returned 401. The Hostinger website returned 200. The first readiness attempt timed out before a successful retry; its cause is unconfirmed. Backup restore, legacy-table RLS, authenticated end-user workflows, and live Azure tenant-isolation drills remain open.

The new integration slice is **tested code, not a live provider connection or deployed feature**. Layer8's signed protocol remains proposed; Pawsome3D and PawPath require verified identity/consent resolvers and dedicated provider credentials. Flags alone cannot enable private data access. GibiWorld has server preflight only; Judy, Stelar, and Shopify are explicitly not connected. See the [integration rollout and activation gates](docs/architecture/INTEGRATION_ROLLOUT.md).

## Run locally

1. Install Node.js 22.12 or newer.
2. Copy `.env.example` to `.env` and provide unique local-only values.
3. Run `npm install`.
4. Run `npm test`.
5. Run `npm run dev`.

To use PostgreSQL, start the local database service, set `DATABASE_URL`, run `npm run migrate`, build the workspace, and run `node scripts/verify-postgres.mjs` before starting the API.

The API starts at `http://127.0.0.1:8080`. Run the web workspace development command for the dashboard shell. See `docs/architecture/HOSTINGER_DEPLOYMENT_SPECIFICATION.md` for the Hostinger-first target.

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
- [Azure backend deployment](docs/architecture/AZURE_BACKEND_DEPLOYMENT.md)
- [Parallel integration rollout](docs/architecture/INTEGRATION_ROLLOUT.md)
- [Phase 1 acceptance report](docs/product/PHASE_1_ACCEPTANCE.md)
- [Phase 2 engineering closeout](docs/product/PHASE_2_ACCEPTANCE.md)
- [Phase 3 intended use specification](docs/product/PHASE_3_INTENDED_USE.md)
- [Phase 3 validation protocol](docs/product/PHASE_3_VALIDATION_PROTOCOL.md)
- [Phase 3 engineering closeout & acceptance](docs/product/PHASE_3_ACCEPTANCE.md)
- [Phase 4 engineering acceptance](docs/product/PHASE_4_ACCEPTANCE.md)
- [Phase 4 pilot specification](docs/product/PHASE_4_PILOT_SPECIFICATION.md)
- [PostgreSQL operations runbook](docs/architecture/POSTGRESQL_OPERATIONS.md)
- [Engineering handoff](HANDOFF.md)
