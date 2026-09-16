# VirtuaPet Phase 4 Engineering Acceptance

## Status

**PASS WITH WARNINGS — engineering foundation and Azure staging deployment.** Phase 4 is not operationally closed.

## Implemented and locally verified

- Version 2 signed spatial-asset manifest schema and canonical payload.
- HMAC-SHA256 signing with timing-safe verification.
- HTTPS-only GLB references and checks for checksum, expiration, revocation, entitlement, semantic client version, units, axes, laterality, bounds, and rollback version.
- Memory and PostgreSQL spatial-manifest persistence methods.
- Migration 004 for versioned spatial-manifest records.
- Separate required credentials for migrator, runtime, and read-only PostgreSQL roles.
- Staging and production readiness reject the in-memory repository.
- 215 automated tests pass after the parallel integration slice; type-check, production build, whitespace check, and high-severity dependency audit pass.
- A fresh temporary PostgreSQL 16 cluster passed bootstrap, migrations 001-004, migration idempotency, persistent repository round trips, application-role DDL denial, and read-only-role write denial.

## Corrections made during review

- Added the missing PostgreSQL spatial methods that previously caused type-check failure.
- Passed the runtime environment into the in-memory repository so its production/staging guard actually runs.
- Removed `SELECT` access to migration history for PostgreSQL `PUBLIC`.
- Required an independent read-only-role password instead of reusing the application password.
- Added existing-table grants for bootstrap reruns.
- Replaced direct signature string comparison with constant-time byte comparison.
- Rejected non-HTTPS model locations.
- Replaced the proposed broad RLS migration. It depended on custom session settings that the runtime role could set and would also have denied current API operations because request identity is not yet transaction-bound.

## Not verified

- Authenticated end-user persistence across a replica replacement. A controlled transaction inside the live replica proved application-role write/read access and was rolled back.
- Live Azure two-tenant isolation and transaction-bound identity on legacy application tables; the local helper/fixture is verified separately.
- Backup retention or point-in-time restore.
- Azure Key Vault/Container Apps secret binding.
- GibiWorld runtime loading or physical headset behavior.
- Robot, travel, drone, or holographic hardware behavior.
- Clinical accuracy or effectiveness.

## Operational closeout gate

Azure bootstrap and migrations 001-004 completed through the private Container Apps environment. The deployed API uses a secret-backed least-privilege role and HTTP dependency-aware readiness. Remaining closeout work is transaction migration for existing tables, live Azure two-tenant tests, failure-mode testing, authenticated persistence across replica replacement, and a non-destructive restore drill. RLS for existing tables requires reviewed per-table policies and must not treat freely settable database settings as independent proof of identity. A new transaction helper passed nine real forced-RLS tests on a disposable local fixture, not the live schema.

## Azure staging evidence — 2026-09-15

- Commit image: `a9f4854e678188c6fee6dc5ed413fceb099ca095`
- Image digest: `sha256:42b6a83a09d34cfb9f2111d7c05745e69bd777e7ebb67bc244c1f84b992f8a37`
- Revision: `virtuapet-staging-api--a9f4854-http`
- Traffic: new revision 100%; prior revision active at 0% for rollback
- Platform probes: HTTP `/healthz` for liveness/startup and HTTP `/readyz` for readiness; revision healthy
- Migration execution: `virtuapet-db-migrate-ir7e1t0`, succeeded
- API checks: health 200, readiness 200, capabilities 200, anonymous protected route 401
- CORS: `https://virtuapet.com` allowed; an untrusted origin received no allow-origin header
- Runtime database identity: `virtuapet_app`, no schema-create privilege
- Updated domain check: `virtuapet.com` returned 200; `api.virtuapet.com` is SNI-bound and returned health/readiness 200 with valid TLS and protected anonymous access 401. One initial readiness attempt timed out before the successful retry.
- Migration checksums:
  - `001_phase2_foundation.sql`: `9ed80983afb26df723fd7b62e68ae49fc176b479e81d46859e342b6fe653f74d`
  - `002_phase2_clinic.sql`: `902f7beedd6bfca1996f9546dbf212b807726d40e253a39274cf026858e62fe7`
  - `003_phase3_clinical_imaging.sql`: `4054434af3db091237983df9dbb7bfd32f4f334cde66445a764c16caefb06048`
  - `004_phase4_spatial_manifests.sql`: `6afc5bf3fd5197701f3913f53d83575445aee24ddcd921e83f61f98d75242927`

## Parallel integration engineering slice

215 total tests, workspace typecheck/build, dependency audit, migration idempotence, repository regression, and nine local isolation checks passed on 2026-09-15. Layer8, Pawsome3D and PawPath adapter code plus GibiWorld server preflight are implemented but default-off/unconnected; current provider contracts, identity/consent linking, operational controls, staging interoperability and device tests remain gates. No new Azure revision or Hostinger artifact was deployed in this slice. See [integration rollout](../architecture/INTEGRATION_ROLLOUT.md) for exact boundaries and parallel CI jobs.
