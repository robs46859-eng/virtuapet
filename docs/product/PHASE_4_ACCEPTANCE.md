# VirtuaPet Phase 4 Engineering Acceptance

## Status

**PASS WITH WARNINGS — local engineering foundation only.** Phase 4 is not operationally closed.

## Implemented and locally verified

- Version 2 signed spatial-asset manifest schema and canonical payload.
- HMAC-SHA256 signing with timing-safe verification.
- HTTPS-only GLB references and checks for checksum, expiration, revocation, entitlement, semantic client version, units, axes, laterality, bounds, and rollback version.
- Memory and PostgreSQL spatial-manifest persistence methods.
- Migration 004 for versioned spatial-manifest records.
- Separate required credentials for migrator, runtime, and read-only PostgreSQL roles.
- Staging and production readiness reject the in-memory repository.
- 39 automated tests pass; type-check, production build, whitespace check, and high-severity dependency audit pass.
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

- Migration 004 against Azure PostgreSQL.
- The live API's use of PostgreSQL rather than memory storage.
- PostgreSQL role restrictions and two-tenant isolation.
- Backup retention or point-in-time restore.
- Azure Key Vault/Container Apps secret binding.
- GibiWorld runtime loading or physical headset behavior.
- Robot, travel, drone, or holographic hardware behavior.
- Clinical accuracy or effectiveness.

## Operational closeout gate

Run the bootstrap, migrations, verifier, role-negative tests, tenant-isolation tests, failure-mode readiness test, and restore drill from an authorized Azure private-network execution environment. RLS for existing tables requires a separately reviewed transaction-bound identity design and must not trust user-controlled request values or freely settable database settings.
