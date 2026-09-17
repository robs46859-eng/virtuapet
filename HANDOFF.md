# VirtuaPet Engineering Handoff

## Current release

Phase 1 and Phase 2 are code-complete at their documented engineering levels. Phase 3 is an engineering prototype: it provides imaging contracts, metadata validation, correction lineage, access gates, signed manifest delivery, PostgreSQL migration 003, and synthetic metric-calculation fixtures. It does not yet implement or validate a clinical DICOM-to-digital-twin pipeline.

Deployment status as of 2026-09-15: `https://virtuapet.com/` returns HTTP 200. Azure revision `virtuapet-staging-api--a9f4854-http` runs the image for commit `a9f4854e678188c6fee6dc5ed413fceb099ca095` and receives 100% of staging API traffic. HTTP liveness uses `/healthz`, readiness uses `/readyz`, and startup uses `/healthz`; the revision is healthy and both endpoints return 200. Capabilities, approved-origin CORS, untrusted-origin denial, and anonymous protected-route denial were also verified. Prior revisions remain active at 0% for rollback.

Updated verification on 2026-09-15: `api.virtuapet.com` is SNI-bound to the existing Azure revision. Health/readiness returned 200 with verified TLS and an anonymous protected request returned 401; Hostinger website returned 200. The first readiness attempt timed out before a successful retry, with no established cause. This supersedes the earlier missing-DNS observation. No new integration code was deployed during this verification.

## Parallel integration foundation — 2026-09-15

Subagents implemented tenant security, Layer8 signed-policy consumption, and Pawsome3D/GibiWorld boundaries in parallel; the parent integrated the HTTP routes, PawPath read adapter, documentation and CI. A separate agent reviewed PawPath and the routes/workflows. See [the rollout specification](docs/architecture/INTEGRATION_ROLLOUT.md) for detailed contracts and acceptance.

- Full local verification: **215 tests pass** (194 API + 21 contracts), typecheck/build pass, zero audit vulnerabilities. Web builds but has no automated tests.
- Disposable PostgreSQL: migrations 001–004 pass, repeat run is idempotent, persistent repository verifier passes, all nine forced-RLS fixture checks pass. This does not enable RLS on application tables or establish Azure tenant isolation.
- Layer8 uses a proposed protocol, pinned asymmetric public keys, request/tenant binding, expiry, and fail-closed entitlement checks. Its deployed contract must be confirmed before enabling.
- Pawsome3D existing-order preview and PawPath nearby reads use observed provider routes. They stay unavailable without server-owned, consent-checked identity linking and dedicated per-user credentials; no global admin token or automatic OIDC forwarding is allowed.
- GibiWorld preflight is server-only; secure client delivery and physical-device acceptance remain open. No clinical geometry or surgical effectiveness was established.
- Six independent integration CI jobs plus real PostgreSQL isolation run alongside full regression CI. Image publication now waits for successful main-push CI and tags the exact tested commit. Azure rollout remains a separate action; no mutable staging tag is updated.
- Judy, Stelar and Shopify remain unconnected. Stripe ownership stays with Layer8; SugarDaddy.lgbt data stays outside commercial integrations.

The earlier next step—confirming Layer8's contract and implementing revocable Layer8 identity links—is superseded by the 2026-09-16 continuation below. Pawsome3D and PawPath still require their own provider-side link contracts. Live activation still requires the explicit success, denial, expiry, revocation, and two-tenant staging tests in the rollout document.

## Layer8 verified-link and architecture continuation — 2026-09-16

The actual `robs46859-eng/layer8` codebase now supplies the provider side of the stable `virtuapet.layer8.policy.v1` contract. VirtuaPet now has a five-minute one-time challenge lifecycle, pinned ES256 proof verification, AES-256-GCM proof storage, revocation, metadata-only listing, forced tenant/user RLS in migration 005, tenant-specific Layer8 credentials, and a real Python-to-Node loopback interoperability verifier. Provider access remains disabled and no cloud secrets, Stripe plans, entitlements, or production revisions were changed.

Local VirtuaPet evidence rechecked on 2026-09-16: 276 tests passed, typecheck and production build passed, the dependency audit found zero vulnerabilities, and the real Layer8-to-VirtuaPet interoperability verifier passed. Layer8 evidence rechecked the same day: 115 tests, Ruff, TypeScript/static export, and the dependency audit passed. GitHub VirtuaPet CI run `35139644559` passed all 12 jobs for `c5636bf`, including migration 005 and its real PostgreSQL forced-RLS verifier; image publication run `35139712525` also passed. Layer8 CI run `35139652852` passed for `f743aa9`. These results verify code and published images, not Azure deployment or live provider activation.

Cloud review on 2026-09-16 initially found no completed integration provisioning. The next phase then began by pinning the existing manual Azure migration job to immutable image `d4d80542b9839aebd221f49fd58ccb408ce5ac3f`. Execution `virtuapet-db-migrate-uxu20be` succeeded: it checksum-confirmed migrations 001–004 and applied `005_integration_identity_links.sql`. The public API remains unchanged on `virtuapet-staging-api--a9f4854-http` at 100% traffic, with no Layer8 integration variables or secrets. Fresh public probes returned 200 for `/healthz`, 200 for `/readyz`, 401 for an anonymous protected route, and 200 for the Hostinger site.

The subsequent prerequisite audit found no VirtuaPet-owned Azure Key Vault, no Redis resource in the Azure subscription, and no Layer8 Container App. Layer8's documented API is hosted separately on Render; fresh probes to `https://api.salti8.com/healthz` and `/readyz` returned 503, and this workstation has neither `env/production.env` nor a Render API credential. No approved VirtuaPet organization-to-Layer8 tenant mapping, signing key, identity-link encryption key, or dedicated `virtuapet:policy` credential was found or claimed. Do not reuse Key Vaults owned by Pawsome3D, Stelar, or unrelated projects.

Architecture v6 adds two separate marketplaces: clinic procurement for veterinary supplies/equipment and consumer booking for day care/overnight services. Neither reuses the retail store or Shopify. The clinical architecture now distinguishes the DICOM-derived anatomical twin from a longitudinal clinical digital twin enhanced by PIMS, labs, and health history, with separate surgical-planning, rehearsal, and PSI design/manufacturing gates. These are target/development specifications, not deployed claims.

Layer8's Azure-native API, dependency readiness, rollback drill, and authorized audit queue-to-Blob path now pass. Next operational sequence: identify real approved staging organizations on both sides; create separate managed signing/encryption keys; create explicit mappings and dedicated per-tenant `virtuapet:policy` keys; configure alert notification routing; deploy the VirtuaPet immutable image to an isolated revision; run two-tenant allowed/denied/expiry/revocation drills; then promote only after Stripe test-mode, browser, custom-domain/TLS, and observability checks. Keep `LAYER8_POLICY_ENABLED` and `LAYER8_IDENTITY_LINKS_ENABLED` false until those gates pass.

On 2026-09-17, Layer8's managed P-256 signing key was provisioned in its own Key Vault. VirtuaPet identity `id-virtuapet-staging` and vault `kv-virtuapet-stg-f7318c` now hold only the public JWKS/key ID plus a separate AES-256 link-encryption key. Revision `virtuapet-staging-api--0000002` returned healthy and ready with both integration flags still false. Trusted `https://virtuapet.com` CORS preflight and public TLS passed. No active real Layer8 tenants, Clerk organization mappings/sessions, dedicated tenant policy keys, or Stripe test credentials were available, so those acceptance gates remain open rather than being simulated.

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

Earlier deployment baseline on 2026-09-15: 39 tests passed, type-check passed, production build passed, `git diff --check` passed, and `npm audit --audit-level=high` reported zero vulnerabilities. A fresh temporary PostgreSQL 16 cluster passed bootstrap, migrations 001-004, a second idempotent migration run, repository verification, runtime-role DDL denial, and read-only-role write denial. The newer integration verification above supersedes the test count with 215 passing tests.

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
3. Preserve the verified `api.virtuapet.com` binding and repeat TLS/API checks for every candidate deployment; confirm the next Hostinger web build targets the custom API host.
4. Perform a non-destructive point-in-time restore drill and record evidence.
5. Exercise readiness failure by safely removing database access from an isolated revision; do not interrupt the active revision.
6. Build on the tested server-side GibiWorld preflight: add trusted asset download/hash, revocation/version lookup and secure delivery before exposing a public manifest endpoint. Do not modify GibiWorld until its runtime work is separately scoped.

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
