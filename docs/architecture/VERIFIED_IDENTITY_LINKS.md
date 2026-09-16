# Verified Layer8 account links

Status: implemented backend foundation; disabled unless configured. Local cryptographic and HTTP tests do not establish a deployed connection or a completed customer account-link flow. The dashboard still needs a reviewed account-connection interface and a real authenticated acceptance run.

## What a link means

A link says that a signed-in VirtuaPet user also authenticated to a specific Layer8 account and agreed to connect that account. Matching email addresses, a typed provider account ID, browser headers, and a decoded but unverified token are not proof.

The record is not a permanent access grant. Its signed authorization lasts at most five minutes. An expired record can remain visible as history, but it cannot authorize a policy request. Refreshing requires a new challenge, a newly authenticated provider proof, and explicit consent. There is no silent permanent refresh credential and no saved Clerk session token.

This implementation connects Layer8 identities only. It does not establish ownership of Pawsome3D orders, permission to use PawPath location data, a clinical consent grant, a subscription purchase, or a connection to Judy, Stelar, Shopify, or SugarDaddy.lgbt. Those remain separate boundaries.

## Request flow

1. VirtuaPet verifies its own OIDC access token. The current organization must have an active, server-owned membership for the user; JWT role names do not override that membership.
2. `POST /v1/integrations/layer8/links/challenges` creates a random, five-minute challenge and nonce bound to the verified VirtuaPet user and organization. No user or organization identifiers can be selected in the body. A newer challenge cancels older pending challenges for that scope.
3. The account-connection client signs in to Layer8 through Clerk and sends the returned `subject`, `tenantId`, `challengeId`, and `nonce` to Layer8's `POST /v1/integrations/virtuapet/link-proof`. That provider endpoint must verify its actual Clerk session, real Layer8 tenant, and operator-approved VirtuaPet-to-Layer8 organization mapping. VirtuaPet never handles or stores the raw Clerk token in this flow.
4. The client submits `{ challengeId, proofToken, consent: true }` to `POST /v1/integrations/layer8/links/complete`, authenticated separately to VirtuaPet. The body must not include provider account identifiers or other extra fields.
5. VirtuaPet verifies the proof and consumes the challenge atomically. It encrypts the signed proof before storage. At most one non-revoked Layer8 link exists for each VirtuaPet user and organization. A successful refresh revokes the previous link.
6. The Layer8 policy adapter asks `resolveProof(context)` for a still-valid proof. Every request must first pass the active VirtuaPet membership gate. The resolver checks signature, context, expiry, record binding, and revocation; the Layer8 policy endpoint independently checks its mapped tenant and current permissions. A policy proof does not replace downstream ownership or purpose-specific consent.
7. `DELETE /v1/integrations/layer8/links/:linkId` disconnects all links and outstanding challenges for this user's organization scope. Deleting even an older scoped link closes the current link, which prevents a stale browser tab from leaving a refreshed grant active.

`GET /v1/integrations/layer8/links` returns up to 100 newest metadata records: link ID, provider, active/expired/revoked state, created/consented/expiry/revoked timestamps. It returns no proof token, nonce, provider account identifier, encryption material, or connection URL. Responses use `Cache-Control: no-store`.

## Signed proof contract

The JWS header is exactly `alg: ES256`, `typ: vp-layer8-link+jwt`, and the operator-pinned `kid`. VirtuaPet uses a pinned local public JWKS; it never follows a token's `jku`, `x5u`, embedded key, or discovery URL. The signing private key belongs only to Layer8.

Claims are strictly limited to:

| Claim | Required meaning |
| --- | --- |
| `iss`, `aud` | Explicit configured Layer8 issuer and the separate identity-link audience. |
| `sub`, `tenantId` | The authenticated VirtuaPet user and organization UUIDs. |
| `iat`, `exp` | Integer UTC seconds; issued no later than now, not expired, and lifetime at most 300 seconds. |
| `jti` | Unique proof UUID. |
| `protocol` | Exactly `virtuapet.layer8.link.v1`. |
| `challengeId`, `nonce` | Exactly the stored one-time challenge and nonce. |
| `providerSubject` | Clerk user identity established by Layer8 authentication. |
| `providerTenantId` | Actual Layer8 tenant identity, not a caller-selected VirtuaPet value. |
| `providerOrganizationId` | Clerk organization identity established by Layer8 authentication. |

The proof must be issued at or after challenge creation (to the precision of integer JWT seconds). There is no positive clock-skew allowance, so both services need synchronized clocks. Wrong issuer, audience, signature, key, tenant, user, challenge, nonce, protocol, extra fields, future issuance, or excessive lifetime deny completion. A consumed challenge cannot be replayed, including concurrent completions.

## Storage and isolation

Migration `005_integration_identity_links.sql` adds three new tables: `integration_identity_link_challenges`, `integration_identity_links`, and `integration_identity_link_audit`. It does not change the policies of existing clinical, pet, membership, or spatial tables.

All three new tables have enabled and forced PostgreSQL row-level security. Rows require both transaction-local `app.tenant_id` and `app.user_id` to match. Missing or empty settings expose no rows and cannot insert rows. The runtime role must not be a superuser or have `BYPASSRLS`; table-owner forcing is not protection against those privileges.

Every store operation obtains one pooled connection and runs its statements through `withIntegrationTransaction`. That sets identity context locally, commits or rolls back, and releases the connection. Each store transaction limits SQL execution to ten seconds and lock waits to five seconds. Mutation operations also acquire a transaction-level advisory lock derived from user and tenant so completion, refresh, and disconnect cannot race across separate connections. Proof and challenge expiry are checked against the database wall clock after any lock wait, not just the caller's earlier timestamp.

Create/complete/revoke audit records are committed in the same transaction as their state changes. They contain only event identifiers, user/tenant/correlation/target UUIDs, event names, and timestamps. The audit table is not a tamper-proof compliance ledger: existing broad runtime grants must be considered, and operators needing immutable audit retention should add a separate restricted append-only export.

Proofs use AES-256-GCM with random 96-bit IVs. Authenticated additional data binds ciphertext to a version label, VirtuaPet tenant, user, and link ID. The database stores a versioned ciphertext, IV, and authentication tag; it does not store the raw proof. The resolver rejects altered or transplanted ciphertext and checks decrypted proof fields against the record. Provider IDs remain internal metadata in the database and require the same privacy controls as other account identifiers.

This is defense in depth, not protection against a fully compromised application: runtime SQL credentials can set custom PostgreSQL settings, and the application holds the decryption key. Database transport must use the same verified TLS policy as the main repository. No direct query of the Layer8 database is used.

## Required configuration

| VirtuaPet variable | Purpose |
| --- | --- |
| `LAYER8_IDENTITY_LINKS_ENABLED` | Must be exactly `true` to request enablement. |
| `LAYER8_LINK_ISSUER` | Exact HTTPS issuer configured by the Layer8 signer. |
| `LAYER8_LINK_AUDIENCE` | Link-specific audience; do not reuse the policy audience. |
| `LAYER8_LINK_KEY_ID` | Pinned public signing key ID. |
| `LAYER8_LINK_JWKS_JSON` | Public ES256 P-256 key set; no private key. |
| `INTEGRATION_LINK_ENCRYPTION_KEY_BASE64` | Secret, canonical base64 encoding of exactly 32 random bytes. |
| `DATABASE_URL` | Restricted VirtuaPet runtime database connection. |

These settings are inputs, not evidence that accounts are connected. Missing or invalid configuration leaves link routes unavailable; there is no production fallback to memory storage or hard-coded encryption key. Provision secrets through the deployment secret store, not source control, Markdown, chat, or the web bundle. The memory store exists for tests only.

The first version supports one encryption key. Changing that key makes existing encrypted proofs unusable; because proofs expire within five minutes, planned rotation can drain existing authorization, revoke links, replace the secret, and require fresh linking. A broader persistent-key rotation scheme is not implemented. Operator-controlled key pin rotation must be coordinated with Layer8.

## Acceptance and remaining work

Focused tests cover successful signed proof completion, AES-GCM storage, safe metadata, wrong identities and claims, bad signatures/keys/headers, expiry, explicit consent, replay, concurrent completion, revocation of pending challenges, record/ciphertext tampering, key changes, scope isolation, rollback on audit failure, transaction-local settings, HTTP authentication/membership, and error redaction. PostgreSQL integration verification must additionally exercise migration 005 using a non-owner, non-bypass runtime role, real concurrent connections, missing context, connection reuse, and expiry across a lock wait; mocked SQL tests are not that evidence.

Before live enablement:

- Deploy the compatible Layer8 signer and this VirtuaPet version through their normal tested release workflows.
- Apply migration 005 with migration authority, grant only needed runtime table operations, and confirm the runtime role has no bypass privileges.
- Configure approved organization mappings, public keys, secret encryption material, and restricted policy service credentials without exposing them.
- Build/review the browser account-connection experience. Do not put proofs or session tokens in URLs, analytics, or logs. Avoid browser-local persistent token storage.
- Run a real signed-in test of link, allowed policy decision, denied action, expiry, refresh, disconnect, wrong organization, and revoked membership. Confirm no downstream provider access is possible from Layer8 identity alone.
- Add operational rate limits for challenge issuance, expired-record cleanup and retention, immutable audit export if required, and incident/key-rotation runbooks before general public rollout.

An already-started upstream request cannot be recalled by local revocation. The resolver rechecks current link state after signature verification; future resolutions deny after disconnect. Any received signed policy decision is also short-lived and must not be reused beyond its original bound request. A new proof after disconnect requires a genuinely new challenge and user authentication/consent.
