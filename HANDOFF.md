# VirtuaPet Engineering Handoff

## Current release

Phase 1 and Phase 2 are code-complete at their documented engineering levels. Phase 3 is an engineering prototype: it provides imaging contracts, metadata validation, correction lineage, access gates, signed manifest delivery, PostgreSQL migration 003, and synthetic metric-calculation fixtures. It does not yet implement or validate a clinical DICOM-to-digital-twin pipeline.

Deployment status as of 2026-09-15: `https://virtuapet.com/` and the Azure Container Apps `/healthz` and `/readyz` endpoints return HTTP 200. These public probes establish availability only. The deployed revision has not been proven to use Azure PostgreSQL, migration 004 is not verified live, and `api.virtuapet.com` remains outside the evidence recorded in this handoff.

The authoritative closeouts are:
- Phase 1: `docs/product/PHASE_1_ACCEPTANCE.md`
- Phase 2: `docs/product/PHASE_2_ACCEPTANCE.md`
- Phase 3: `docs/product/PHASE_3_ACCEPTANCE.md`
- Phase 4: `docs/product/PHASE_4_ACCEPTANCE.md`

They separate completed engineering evidence from outstanding operational, external clinical, and hardware authorizations.

## Reproduce the accepted build

1. Install Node.js 22.12 or newer and run `npm ci` (or `npm install`).
2. Run `npm run typecheck`, `npm test`, and `npm run build`.
3. Start a fresh supported PostgreSQL database.
4. Set `DATABASE_URL` and run `npm run migrate`.
5. Run `node scripts/verify-postgres.mjs` with the same connection string.
6. Run `npm audit --audit-level=high`.

Latest local verification on 2026-09-15: 39 tests passed, type-check passed, production build passed, `git diff --check` passed, and `npm audit --audit-level=high` reported zero vulnerabilities. A fresh temporary PostgreSQL 16 cluster passed bootstrap, migrations 001-004, a second idempotent migration run, repository verification, runtime-role DDL denial, and read-only-role write denial. Azure execution remains unverified.

## Phase 3 clinical twin validation status

- Approved narrow intended use: Canine TPLO Computed Tomography Pre-Operative Planning and Virtual Rehearsal (`docs/product/PHASE_3_INTENDED_USE.md`).
- Approved validation protocol: Multi-site patient-separated holdout design across 3 referral hospitals (`docs/product/PHASE_3_VALIDATION_PROTOCOL.md`).
- Synthetic calculation-fixture results (50 generated records; not patients or hospitals):
  - 100% patient, study, series, laterality, units, and orientation preservation (0 mismatches).
  - 100% source-to-rendered-structure traceability.
  - 100% veterinarian pre-rehearsal approval enforcement.
  - 98.0% linear measurement accuracy within 1.5 mm or 2.5% (GATE-04).
  - 96.0% TPA angular accuracy within 1.0 degree (GATE-05).
  - 100% critical-surface HD95 <= 1.5 mm (GATE-06).
  - Average Dice: Tibia 0.956, Femur 0.941, Patella 0.923 (GATE-07).
  - 100% watertight 2-manifold topology (GATE-08).
  - 94.0% unassisted rehearsal completion (GATE-09).
  - Median SUS 87.5 / 100 (GATE-10).
  - Zero hidden subgroup failures across body size, scanner, protocol, or pathology (GATE-11).
- 25 passing automated tests across contracts, API, and imaging services at the last recorded baseline; rerun after every change.

## Phase 4 spatial and mobility pilots

- Implemented locally: signed spatial-manifest contract, migration 004 spatial storage, memory and PostgreSQL repository methods, timing-safe signature comparison, HTTPS asset restriction, and staging/production in-memory readiness rejection.
- Corrected during review: the original migration attempted broad RLS using client-set custom PostgreSQL settings before the API had transaction-bound request identity. That unsafe, deployment-breaking policy set was removed. Database RLS remains an explicit open gate, not a completed claim.
- Connect GibiWorld Unity and AR runtime to approved, signed clinical twin manifests.
- Validate scale, axes, laterality, entitlement, rollback, and device compatibility across Apple Vision Pro and Meta Quest 3.
- Build the low, stable pet-assistant robot alpha with local safety control.
- Pilot partner ground-travel corridors and custody evidence.
- Restrict drones to permitted property and exclude live-animal drone transport.
- Follow `docs/product/PHASE_4_PILOT_SPECIFICATION.md`; no hardware or live-animal acceptance has occurred.

### Immediate operational sequence

1. Authenticate Azure CLI with the approved tenant without placing credentials in chat or source control.
2. Run the bootstrap and migrations from a one-time Container Apps job attached to the PostgreSQL private network.
3. Bind the least-privilege runtime `DATABASE_URL` through an Azure secret reference and deploy a new API revision.
4. Prove migration checksums, PostgreSQL-backed persistence, readiness failure on database loss, role restrictions, and two-tenant denial cases.
5. Perform a non-destructive point-in-time restore drill and record evidence.
6. Design transaction-bound database identity before enabling RLS on existing tenant tables.

## Phase 5 commercial scale

- Package validated VetOS and rehearsal tiers.
- Scale only after retention, margin, implementation, safety, support, privacy, and recovery gates pass.
- Expand robot manufacturing and travel only after unit economics and operational evidence pass.
- Keep AR, mixed-reality, stereoscopic, light-field, and holographic claims technically accurate.

## Cross-phase operational work

- Configure live identity and membership synchronization.
- Integrate Layer8 signed decisions, Stripe entitlements, API management, audit, and human escalation.
- Deploy the Hostinger-first topology in `docs/architecture/HOSTINGER_DEPLOYMENT_SPECIFICATION.md`, with separate development, staging, and production boundaries.
- Publish and verify Hostinger website and API artifacts with rollback; operate PostgreSQL 16 on a dedicated Hostinger VPS only after backup, restore, TLS, patching, monitoring, and least-privilege evidence exists.
- Store runtime values in Hostinger environment-variable controls. A hardware-backed or managed signing service remains mandatory before clinical authorization; an hPanel or VPS environment value is only an engineering-pilot fallback.
- Add Service Bus publication, RLS, backup, restore, recovery, security, and accessibility evidence.
- Maintain the independent SugarDaddy.lgbt governance and data boundary.

## Prohibited unsupported claims

Do not claim production deployment, live customers, clinical effectiveness, autonomous surgical guidance, automated primary diagnosis, device safety, robot readiness, travel operations, drone certification, profitability, or design-partner acceptance without fresh evidence for that exact claim.
