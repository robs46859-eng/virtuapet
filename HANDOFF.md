# VirtuaPet Engineering Handoff

## Current release

Phase 1 and Phase 2 are code-complete at their documented engineering levels. Phase 3 is an engineering prototype: it provides imaging contracts, metadata validation, correction lineage, access gates, signed manifest delivery, PostgreSQL migration 003, and synthetic metric-calculation fixtures. It does not yet implement or validate a clinical DICOM-to-digital-twin pipeline.

Deployment status as of 2026-09-14: `virtuapet.com`, `www.virtuapet.com`, and `api.virtuapet.com` returned no A or CNAME records during the latest check. The user expects the domain to become available shortly. This is a pending external activation, not a failed deployment and not proof of launch.

The authoritative closeouts are:
- Phase 1: `docs/product/PHASE_1_ACCEPTANCE.md`
- Phase 2: `docs/product/PHASE_2_ACCEPTANCE.md`
- Phase 3: `docs/product/PHASE_3_ACCEPTANCE.md`

They separate completed engineering evidence from outstanding operational, external clinical, and hardware authorizations.

## Reproduce the accepted build

1. Install Node.js 22.12 or newer and run `npm ci` (or `npm install`).
2. Run `npm run typecheck`, `npm test`, and `npm run build`.
3. Start a fresh PostgreSQL 16 database.
4. Set `DATABASE_URL` and run `npm run migrate`.
5. Run `node scripts/verify-postgres.mjs` with the same connection string.
6. Run `npm audit --audit-level=high`.

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

- Connect GibiWorld Unity and AR runtime to approved, signed clinical twin manifests.
- Validate scale, axes, laterality, entitlement, rollback, and device compatibility across Apple Vision Pro and Meta Quest 3.
- Build the low, stable pet-assistant robot alpha with local safety control.
- Pilot partner ground-travel corridors and custody evidence.
- Restrict drones to permitted property and exclude live-animal drone transport.

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
