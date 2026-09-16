# Pawsome3D and GibiWorld integration boundary

Status: implemented, default-off server adapter and contract tests. This is not a live provider connection, a finished Unity feature, or clinical validation.

## What this slice does

VirtuaPet can ask Pawsome3D for a short-lived preview link to an existing 3D order. It cannot create an order, charge credits, approve a model, upload a photo, start generation, or publish a model. The result is marked `visual_preview_only` and `clinicalUse: false`.

`createPawsome3DPreviewAdapter(config, dependencies)` exposes:

- `status()`: local configuration only; states are `disabled`, `not_configured`, or `configured_unverified`. It performs no network request and cannot claim the provider is live.
- `getPreview(context, orderId)`: one authenticated GET using a separately linked Pawsome3D account. It returns a bounded, validated preview response or a redacted error.

## Observed provider contract

Read-only source inspection of the separate `/Users/robert/PawsMemories` checkout found:

| Source | Observed behavior |
| --- | --- |
| `server.ts` | Mounts `/api/pet-glb` behind `requireAuth`. |
| `auth.ts` | Expects its own Bearer JWT. `phone` is now an opaque internal account key, not a telephone number. This is not VirtuaPet's OIDC token. |
| `server/pet-generation/routes.ts` | Exposes `GET /orders/:orderUuid/stages/current/preview`. |
| `server/pet-generation/service.ts` | `previewCurrentStage` checks order ownership, selects the current available artifact, and returns `{url, versionId, expiresInSeconds}`. `requireOwned` also allows a provider administrator. |

These are observed implementation paths, not invented endpoints. That checkout has independent work in progress; source inspection does not prove those exact bytes are deployed. No provider file was edited, and no authenticated production preview was requested.

## Authentication and ownership

1. The VirtuaPet route verifies the caller's normal identity.
2. `requireIntegrationContext` must find an active server-owned organization membership. Tenant or role headers are not authority.
3. The route checks its current entitlement policy and current pet/account data-sharing consent before invoking this adapter. A clinical consent grant must not be repurposed as model-generation permission.
4. `resolveDelegation(context, orderId)` must retrieve a **server-owned, verified** account-and-order link and a dedicated per-user provider token. The returned provider name, VirtuaPet user, tenant, and order must all match this request. A caller-supplied structure or decoded-but-unverified JWT is not a verified link.
5. Pawsome3D independently validates its own token and ownership. Its administrator bypass means a shared administrator token is unacceptable for this resolver.

The resolver is deliberately not implemented from environment secrets or request headers. Until account linking, revocation, and consent are verified, the deployed adapter remains disabled or unconfigured. Never automatically forward the VirtuaPet OIDC Authorization header, reuse a global service token, share Pawsome3D's JWT signing key, or query Pawsome3D's database directly.

## Configuration and transport

Configuration is copied when the adapter is created. Later mutation cannot change the provider destination or asset allowlist.

- `enabled` defaults to false.
- `baseUrl` must be an explicitly trusted HTTPS origin, without credentials, path, query, or fragment.
- `allowedAssetOrigins` lists the exact HTTPS storage origins approved for preview links; no suffix wildcard matching.
- IP literals, localhost/local/internal names, fragments, credentials, and non-443 ports are rejected.
- The provider URL is assembled only from the configured origin and a validated UUID.
- One GET, no retry, no redirect following, no cookies, no arbitrary forwarded headers.
- The default deadline is five seconds, at most fifteen. It covers account-token resolution, provider response headers, and the streamed body. A resolver that finishes after timeout cannot start a late provider request.
- The default response limit is 16 KiB, at most 64 KiB, enforced even when Content-Length is absent.
- Only the three observed JSON fields are accepted. Link lifetime must be between 1 and 3,600 seconds. The returned asset URL must match an approved origin.
- Error bodies, provider tokens, signed query strings, and raw network errors must not be logged or returned. Route responses containing signed preview links must use `Cache-Control: no-store`.

Operator allowlists are a trust boundary, not a DNS-rebinding defense. Only approve controlled public origins, restrict egress at deployment, and verify their DNS/network destination before enabling. The adapter does not download model bytes and does not follow an asset URL or its redirects.

## GibiWorld preflight: a separate, server-only helper

`validateGibiWorldHandoff` wraps the existing version-2 spatial manifest validator with mandatory checks for:

- current caller user and tenant matching manifest owner and tenant;
- HMAC signature, unexpired/unrevoked manifest state, finite geometry values;
- trusted downloaded-byte SHA-256, granted entitlements, client version, units, axes, and laterality;
- an explicitly allowed model storage origin and a valid server clock.

Unlike the low-level legacy validator, these gates cannot be skipped by omitting optional checks. The helper emits neither the HMAC signature nor its verification key. Its result remains for visual preview only.

This helper is **not yet a public GibiWorld delivery endpoint**. It accepts the checksum and grants from trusted server code; they must never come from untrusted client assertions. Before exposing delivery, the service must download with bounded and protected egress, compute the actual content hash, retrieve current revocation/version state, recheck consent and entitlement, and issue an authenticated short-lived delivery envelope. GibiWorld must then verify that envelope and model checksum. No symmetric HMAC secret belongs in Unity, a browser bundle, or an API response.

The legacy manifest canonicalizer sorts lineage values, so its signature does not prove lineage order. Do not use version-2 lineage as ordered clinical/audit evidence. A future versioned signing contract and migration are required before stronger provenance claims. This slice deliberately does not silently change already signed version-2 documents.

## Evidence and remaining acceptance gates

Run `npm test --workspace @virtuapet/api -- src/integrations/spatial.test.ts` and `npm run typecheck --workspace @virtuapet/api`.

The fake-provider tests cover default-off, missing identity link, user/tenant/order mismatch, invalid IDs, provider 401/403/404/5xx/redirects, response size, schema rejection, unsafe asset links, invalid preview lifetimes, timeout including a late resolver, redacted errors, immutable configuration, and strict server-side manifest preflight including expired/revoked manifests. They do not prove live provider authentication or headset behavior.

Still required before enabling:

1. Confirm the provider's deployed origin and storage origins with its owner.
2. Implement explicit account linking and scoped per-user credentials with revocation. Persist a tenant-scoped order association and consent, not a global token.
3. Test two genuine tenant accounts and revoked/missing consent end to end, including provider ownership denial; do not use administrator tokens.
4. Verify a real preview and the hash of its downloaded model without starting paid generation.
5. Add and test the secure GibiWorld delivery envelope, runtime consumption, signed-link expiry, revoked entitlement, rollback/version handling, and physical-device placement/scale.
6. Complete separate clinical evidence requirements before any surgical-rehearsal or DICOM accuracy claim. A photogrammetry preview is not a validated anatomical twin.
