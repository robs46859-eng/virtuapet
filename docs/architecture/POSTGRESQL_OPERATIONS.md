# PostgreSQL Operations Runbook

## Security boundary

Use three unique login roles and passwords: `virtuapet_migrator`, `virtuapet_app`, and `virtuapet_readonly`. Store values in approved Azure secret references. Never commit them, paste them into reports, or pass them as visible command arguments. PostgreSQL remains on private networking with TLS certificate verification.

## Bootstrap and migration

Run `npm run bootstrap:postgres` with the administrative connection only from an authorized private-network job. Then run `npm run migrate` using the migrator connection. The migrator takes an advisory lock and refuses a previously applied migration whose checksum changed. Run `node scripts/verify-postgres.mjs` afterward.

Do not run migrations with the runtime application role. Do not grant schema creation, database creation, role creation, replication, superuser, or migration ownership to the runtime role.

## Deployment verification

Verify the exact migration names and checksums, runtime login role, encrypted connection, application persistence across process restart, readiness failure when database access is removed, and denial of schema changes by the runtime and read-only roles. Exercise two controlled tenants and record both permitted and rejected operations.

## Recovery

Confirm Azure backup retention from the resource configuration. Restore to a new staging server or database name; never overwrite the active database for a drill. Validate schema migration history, row counts for a controlled sample, application-role access, tenant isolation, and API startup. Record recovery point, recovery duration, restored resource ID, validation results, and cleanup owner.

## Credential rotation

Create a new unique credential, update the Azure secret reference, deploy a new revision, verify readiness and a controlled database operation, then revoke the old credential. Keep the previous application revision available only for the bounded rollback window and never record either credential in the handoff.

## RLS prerequisite

Before enabling row-level security on existing tables, implement a transaction-scoped, server-controlled identity binding and prove that pooled connections cannot leak user or tenant context. A custom setting that the runtime database role can freely choose is not an authorization boundary. Add integration tests for connection reuse, missing context, forged context, cross-tenant reads and writes, administrative maintenance, and transaction rollback.
