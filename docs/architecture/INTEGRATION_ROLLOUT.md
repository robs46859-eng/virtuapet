# VirtuaPet parallel integration rollout


## Deployment update — 2026-09-17

The real Layer8 signed protocol is deployed in both repositories. VirtuaPet uses Entra; SALTI8 uses Clerk. The two UUID-to-tenant mappings and tenant-scoped policy credentials are provisioned through Key Vault. Live browser sessions prove both Entra guests have access only to their assigned VirtuaPet organization. VirtuaPet identity-link and policy flags remain disabled pending signed link and policy acceptance described in `../product/PRODUCTION_STATUS_AND_REMAINING_PHASES_2026-09-17.md`.

Document ID: `VP-ARCH-INTEGRATIONS-001`

Recorded: 2026-09-15

Release level: tested engineering foundation; external connections are disabled.

## What is implemented versus connected

| Workstream | Implemented in this repository | Not yet completed |
| --- | --- | --- |
| Tenant security | Server-membership gate; live reciprocal Entra organization denial; transaction-local tenant/user context; real PostgreSQL isolation fixture | Transaction migration and reviewed RLS for legacy application tables; live Azure database-isolation proof |
| Layer8 | Asymmetric signed-policy consumer, exact request binding, fail-closed entitlement check | Inspected operator repository lacks the required endpoint; production-service contract, live keys, tenant mapping and staging interoperability remain gates |
| Pawsome3D | Read-only existing-order preview adapter using observed provider route | Verified account/order links, revocable consent, dedicated per-user credentials, live ownership tests |
| GibiWorld | Strict server-only spatial-manifest preflight | Safe asset download/hash, current revocation lookup, signed client delivery, Unity consumption, physical device tests |
| PawPath | Read-only nearby-user adapter using observed provider route; explicit location-sharing input | Linked provider identities, privacy/consent end-to-end tests, deployed provider verification |
| Judy, Stelar, Shopify | Explicit not-connected status and retained service boundaries | Confirm contracts/owners, implement scoped adapters and acceptance tests |

Stripe remains owned by Layer8's existing billing integration. No duplicate checkout or webhook was added. SugarDaddy.lgbt is not an integration in this commercial API; its nonprofit data and systems remain separate. No legacy provider repository, paid generation operation, clinical claim, or hardware behavior was changed.

## Request workflow

1. Verify the normal VirtuaPet OIDC token.
2. Read an active server-owned membership for the token's organization. Client headers cannot choose another tenant or role.
3. Validate the operation input. For PawPath, require `shareLocation: true` on every nearby request.
4. Ask Layer8 for the fixed server-selected action, resource, purpose, and required entitlement. Consume a short-lived, signed allow for this exact request or stop.
5. Resolve a server-owned provider identity and, for previews, exact order link. This resolver must check current consent and revocation and return a dedicated per-user token, never an administrator token. **The default server has no resolver yet and therefore cannot release provider records.**
6. Perform one bounded provider read with no redirects or retries. Return validated fields and safe errors with `Cache-Control: no-store`.

Ownership and consent are mandatory resolver prerequisites, not satisfied by a paid entitlement. Provider token exchange/account linking is deliberately not fabricated from the caller's headers. Environment flags alone cannot activate private-data access. No raw pet health, DICOM, or nonprofit records flow through these adapters.

## HTTP surface

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/integrations` | Authenticated membership-scoped configuration inventory; not a health probe |
| `GET /v1/integrations/pawsome3d/orders/:orderId/preview` | Entitled, identity-linked read of an existing visual preview; non-clinical |
| `POST /v1/integrations/pawpath/nearby` | Entitled nearby search with JSON `latitude`, `longitude`, optional `radiusMeters` (100–5000, default 5000), and affirmative `shareLocation` |

PawPath's observed provider route is `/api/pawpath/map/users`, mounted by PawsMemories `server.ts`, not the earlier planned `/v1/map/users`. Coordinates stay out of VirtuaPet's URL logs. Provider source inspection is not evidence that its current working-tree changes are deployed. There is no public arbitrary Layer8-policy endpoint, asset proxy, GibiWorld delivery endpoint, paid generation endpoint, or generated fallback population.

## Parallel GitHub workflows

`ci.yml` runs six independent test jobs: membership context, transaction handling, Layer8, spatial adapters, PawPath, and HTTP routes. `fail-fast: false` preserves results from every stream. A separate PostgreSQL job exercises nine forced-RLS checks against a disposable database. The existing full typecheck, tests, build, migrations, and repository checks remain required.

`publish-api-image.yml` runs only after successful CI from a push to this repository's `main`. It checks out and tags the exact verified commit, rather than whichever commit happens to be current later. It no longer moves a mutable `staging` tag. There is no manual publish bypass or automatic Azure deployment. Deployment must consume the published immutable digest and retain the previous known-good revision.

Local commands:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:integrations
TEST_DATABASE_URL=postgresql://LOCAL_TEST_ADMIN@127.0.0.1:55487/virtuapet_integrations_test npm run verify:integration-isolation
```

The last command requires a disposable loopback database ending in `_test`. It does not use the application's database URL. See [tenant security](INTEGRATION_TENANT_SECURITY.md) for the local fixture and custom-setting trust boundary.

## Verification recorded for this slice

- Full suite: **215 tests passed** (194 API, 21 contracts). Web has no automated tests; its production build passed.
- Workspace typecheck and production build passed; dependency audit found zero vulnerabilities.
- PostgreSQL 16: migrations 001–004 applied; second run idempotent; repository regression verifier passed.
- Nine real forced-RLS checks passed under a nonowner/no-BYPASSRLS role, including two tenants reusing one connection, missing context, cross-tenant writes, commit cleanup, and rollback cleanup. Temporary role/table cleanup was checked.
- All provider tests use fixtures or fake transports. No provider credential or live private data was used.
- Existing deployment check: Hostinger website returned 200; custom API health/readiness returned 200 with verified TLS and protected anonymous request returned 401. The first readiness attempt timed out; a fresh retry succeeded in about 0.21 seconds. No cause was established for that transient failure.
- Azure still serves revision `virtuapet-staging-api--a9f4854-http` at 100%, with `api.virtuapet.com` bound using SNI. **This integration slice is not deployed by these checks.**

## Next release acceptance, in order

1. **Provider agreements and identity links:** locate the current Layer8 contract; approve the proposed signed decision format or adapt to the real one. Implement tenant-scoped per-user provider linking, order associations, consent records, token revocation, and minimum permissions. Never collect credentials through chat.
2. **Operational controls:** add durable decision/access audit, provider rate limits, egress restrictions, abuse protections, and alerts. Prove outages fail closed and no secret/signed URL/location data leaks into logs.
3. **Staging activation:** configure one non-clinical provider at a time with test accounts through managed secrets. Prove own-resource success, other-tenant denial, expired/revoked entitlement denial, revoked consent denial, and disabled/missing-provider behavior. Capture a real read without a purchase or paid generation.
4. **Database closeout:** migrate legacy repository/worker paths to transaction-bound identity before enabling per-table RLS; run Azure two-tenant tests and a non-destructive backup restore drill.
5. **GibiWorld:** implement safe download and measured checksum, current revocation/version lookup and asymmetric short-lived delivery; validate client expiry/rollback/axes/scale on physical devices. Keep all clinical efficacy claims gated separately.
6. **Release:** verify all parallel CI checks and published digest, deploy an isolated Azure candidate, run authenticated smoke and negative tests, then authorize a traffic shift. Confirm the Hostinger UI uses the approved API host and actual connected features before labeling them live.

See [Layer8](LAYER8_INTEGRATION.md), [spatial providers](SPATIAL_PROVIDER_INTEGRATION.md), and [engineering handoff](../../HANDOFF.md).
