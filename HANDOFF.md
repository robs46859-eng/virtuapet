# VirtuaPet Engineering Handoff

## Current release

Phase 1 and Phase 2 are code-complete at their documented engineering levels. Phase 3 is an engineering prototype: it provides imaging contracts, metadata validation, correction lineage, access gates, signed manifest delivery, PostgreSQL migration 003, and synthetic metric-calculation fixtures. It does not yet implement or validate a clinical DICOM-to-digital-twin pipeline.

Deployment status as of 2026-09-15: `https://virtuapet.com/` returns HTTP 200. Azure revision `virtuapet-staging-api--a9f4854-http` runs the image for commit `a9f4854e678188c6fee6dc5ed413fceb099ca095` and receives 100% of staging API traffic. HTTP liveness uses `/healthz`, readiness uses `/readyz`, and startup uses `/healthz`; the revision is healthy and both endpoints return 200. Capabilities, approved-origin CORS, untrusted-origin denial, and anonymous protected-route denial were also verified. Prior revisions remain active at 0% for rollback.

`api.virtuapet.com` is not active: fresh DNS checks returned no A or CNAME record, HTTPS could not resolve the host, and the Container App has no custom-domain binding. Do not report this hostname as deployed until Hostinger DNS and Azure certificate binding are completed and tested.

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

Latest local verification on 2026-09-15: 39 tests passed, type-check passed, production build passed, `git diff --check` passed, and `npm audit --audit-level=high` reported zero vulnerabilities. A fresh temporary PostgreSQL 16 cluster passed bootstrap, migrations 001-004, a second idempotent migration run, repository verification, runtime-role DDL denial, and read-only-role write denial.

Azure database and deployment evidence:

- Private PostgreSQL server: `virtuapet-staging-pg`; public network access remains disabled.
- Manual job `virtuapet-db-bootstrap` execution `virtuapet-db-bootstrap-zetl5h8` succeeded.
- Manual job `virtuapet-db-migrate` execution `virtuapet-db-migrate-ir7e1t0` succeeded and logged migrations 001-004.
- The API obtains `DATABASE_URL` from the `database-url` Container Apps secret. Generated passwords were not written to Git or documentation.
- Direct execution inside the deployed replica confirmed `current_user=virtuapet_app`, database `virtuapet`, no `CREATE` privilege on schema `public`, all four migration records, and a transactionally rolled-back write/read round trip.
- Published image digest: `sha256:42b6a83a09d34cfb9f2111d7c05745e69bd777e7ebb67bc244c1f84b992f8a37`.
- PostgreSQL backup retention is 7 days with geo-redundant backup disabled. No restore drill has been completed.

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

1. Design and implement transaction-bound database identity before enabling RLS on existing tenant tables.
2. Prove two-tenant allowed and denied cases against Azure PostgreSQL using controlled authenticated identities.
3. Add the required Hostinger DNS verification record and API CNAME, bind `api.virtuapet.com` to Container Apps with a managed certificate, and verify DNS/TLS/API behavior.
4. Perform a non-destructive point-in-time restore drill and record evidence.
5. Exercise readiness failure by safely removing database access from an isolated revision; do not interrupt the active revision.
6. Start the VirtuaPet-side GibiWorld manifest API and adapter without modifying the GibiWorld repository.

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
