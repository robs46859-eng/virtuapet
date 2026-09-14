# VirtuaPet Engineering Handoff

## Current release

Phase 1 and the Phase 2 engineering pilot are code-complete. Phase 2 provides OIDC verification support, server-owned clinic memberships, PostgreSQL persistence, Pet Profile and consent workflows, manual Feline Grimace Scale observations, appointments, recalls, inventory, clinic messages, regulation evidence review, CI, and the Phase 2 dashboard.

The authoritative closeout is `docs/product/PHASE_2_ACCEPTANCE.md`. It separates completed engineering evidence from outstanding operational and clinical approvals.

## Reproduce the accepted build

1. Install Node.js 22.12 or newer and run `npm ci`.
2. Run `npm run typecheck`, `npm test`, and `npm run build`.
3. Start a fresh PostgreSQL 16 database.
4. Set `DATABASE_URL` and run `npm run migrate`.
5. Run `node scripts/verify-postgres.mjs` with the same connection string.
6. Run `npm audit --audit-level=high`.

## Phase 3 clinical twin validation

Build a separate imaging service for veterinary DICOM ingestion, de-identification, series validation, volume reconstruction, segmentation, clinician correction, mesh generation, quantitative QA, signed model packaging, and source-linked rehearsal delivery.

First approve one narrow veterinary intended use, anatomy, species, modality, and procedure. Then approve dataset governance and a validation protocol with a veterinary clinical owner. Implement immutable Study, Series, Volume, Segmentation, Mesh, Clinical Model, Plan, Rehearsal, and Approval contracts; quarantine and integrity controls; isolated workers and storage; provenance and versioning; clinician correction and approval; signed GibiWorld manifests; and procedure-specific holdout evaluation.

Phase 3 cannot close on synthetic smoke tests alone. It requires veterinarian approval, independent holdout results, complete traceability, and zero patient or laterality mismatches.

## Phase 4 spatial and mobility pilots

- Add GibiWorld rehearsal for approved clinical derivatives.
- Validate scale, axes, laterality, entitlement, rollback, and device compatibility.
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
- Deploy Azure development, staging, and production boundaries.
- Publish verified Hostinger artifacts with rollback.
- Add Service Bus publication, RLS, backup, restore, recovery, security, and accessibility evidence.
- Maintain the independent SugarDaddy.lgbt governance and data boundary.

## Prohibited unsupported claims

Do not claim production deployment, live customers, clinical accuracy, regulatory compliance, autonomous diagnosis, device safety, robot readiness, travel operations, drone certification, profitability, or design-partner acceptance without fresh evidence for that exact claim.
