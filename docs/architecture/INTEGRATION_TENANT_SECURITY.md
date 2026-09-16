# Integration tenant security

Status: implemented foundation and local verification harness. This document does not establish live Azure tenant isolation or enable RLS on existing application tables.

## Request identity

New integration routes call `requireIntegrationContext(repository, principal, requestedOrganizationId?, requiredRoles?)` after the existing authentication hook verifies the bearer token. The helper accepts no request headers. `principal` must come from that verifier; constructing it from request bodies or tenant headers violates this boundary.

The authenticated principal must carry a valid user UUID and organization UUID. A tenant ID in the route or request must match that authenticated organization. Selecting another organization requires authentication context for that organization and a current membership check.

`findMembership` is the source of organization role authority. The helper rechecks the returned membership's user, organization, active status, revocation timestamp, and role. JWT role claims do not grant membership privileges or a platform-administrator bypass. Required roles are an allow-list supplied by route code. A fresh server-generated correlation UUID traces the request without treating user input as audit authority.

The resulting `IntegrationContext` contains `userId`, `tenantId`, `roles`, and `correlationId`. An object of this TypeScript type is not itself proof of authentication. Server code must obtain it through the helper, validate resource ownership separately, and retain the existing consent checks for pet data. Long-running asynchronous work must recheck membership, consent, and entitlement before releasing a result; membership can change after a request starts.

## Transaction boundary

`withIntegrationTransaction(pool, context, async client => { ... })` validates context, checks out one PostgreSQL connection, begins a transaction, and applies three parameter-bound PostgreSQL settings:

- `app.tenant_id`
- `app.user_id`
- `app.correlation_id`

Each setting uses `set_config(name, value, true)`. The final `true` limits its lifetime to the transaction. All callback SQL must use the supplied `client`. Calling `pool.query()` or a legacy repository method inside the callback can use another connection and does not inherit the context.

Success commits; errors roll back. The connection is always released. If rollback fails, the connection is discarded to prevent reuse in an unknown transaction state. Context has no administrator or RLS bypass flags. Application code must never set these identity values at session scope or accept them directly from the client.

## What this protects, and what remains

The membership gate rejects mismatched tenants and forged role claims at the application boundary. Transaction-local settings prevent a request's identity from leaking into the next ordinary transaction on a reused connection.

Custom PostgreSQL settings remain writable by the runtime SQL role. A compromised server or an attacker who can execute arbitrary SQL as that role can change them. Therefore these settings are context propagation, not an independent cryptographic identity boundary. Do not describe this helper as protection against compromised runtime credentials.

The legacy repository still executes its existing queries through `pool.query()`. This change does not retrofit those queries or turn on RLS for its tables. Production RLS requires a reviewed per-table ownership policy, explicit consent semantics, transaction-bound repository operations, a runtime account without table ownership or `BYPASSRLS`, migration and worker role separation, revocation behavior, and live two-tenant tests. Enable policies only after those paths are migrated and checked. An application health response is not isolation evidence.

## Local PostgreSQL verification

Build first, then run with a connection to a disposable PostgreSQL database whose name ends in `_test`:

```sh
npm run build --workspace=@virtuapet/contracts
npm run build --workspace=@virtuapet/api
TEST_DATABASE_URL=postgresql://LOCAL_TEST_ADMIN@127.0.0.1:55487/virtuapet_integrations_test node scripts/verify-integration-isolation.mjs
```

Replace `LOCAL_TEST_ADMIN` with the local disposable cluster administrator. Use a local trust-authenticated test cluster or a private environment variable for credentials. Never place real passwords in this command. The script rejects non-loopback hosts, databases without the `_test` suffix, and URL query options; it never reads the application's `DATABASE_URL`.

The verifier creates a session-local temporary table and a randomly named non-login fixture role. It enables and forces RLS, grants only the test table's data operations, switches to that non-owner role, and uses a one-connection pool. Finally it removes the temporary table, its grants, and the fixture role. It does not read or change the application's tables or migrations. Run only against a disposable cluster: interrupting the process can leave a harmless non-login fixture role until that cluster is removed.

The checks prove:

1. The test actually runs with forced RLS as a non-owner without superuser or `BYPASSRLS`.
2. Missing context returns no rows and rejects inserts.
3. Tenant A reads only its records.
4. Tenant B reads only its records on the same physical connection.
5. A mismatched user sees no records.
6. Commit clears tenant, user, and correlation settings.
7. Cross-tenant insertion, ownership changes, and deletion fail.
8. Allowed writes persist between transactions.
9. Callback failure rolls back the write and clears context before reuse.

Unit tests separately cover forged roles, revoked or mismatched membership, malformed identities, context validation, commit failure, and rollback failure. Passing this temporary-table verifier proves the helper's local PostgreSQL behavior; it does not prove isolation on the Azure application schema.

### Recorded verification

On 2026-09-15, the two focused test files passed all 18 unit tests, the API TypeScript build passed, and the verifier passed all nine checks on the disposable local PostgreSQL cluster at port 55487. A separate catalog query then confirmed zero remaining `vp_isolation_` fixture roles and zero `integration_isolation` tables. These results cover the local fixture only; Azure and legacy-table RLS remain unverified.
