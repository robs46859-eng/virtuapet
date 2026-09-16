# VirtuaPet Azure Backend Deployment

Document ID: `VP-ARCH-AZURE-BACKEND-001`

## Decision

Keep `virtuapet.com` and `www.virtuapet.com` on Hostinger. Run the Fastify API at `api.virtuapet.com` in Azure Container Apps and use Azure Database for PostgreSQL Flexible Server as the system of record. Hostinger remains the DNS owner and public website host.

Do not connect this repository to Hostinger managed MySQL. The current migrations, repository implementation, JSONB fields, constraints, and `pg` driver are PostgreSQL-specific. A MySQL conversion would be a separate application migration, not a deployment setting.

## Initial Azure services

| Service | Initial purpose | Release boundary |
|---|---|---|
| Azure Container Apps | Run the containerized Fastify API with HTTPS ingress and revisions | Public ingress; protected routes remain OIDC-gated |
| Azure Database for PostgreSQL Flexible Server | Pet, consent, clinic, regulation-evidence, and clinical-prototype metadata | No raw DICOM objects |
| Azure Container Registry | Store immutable API images | Managed-identity pull only |
| Azure Key Vault | Hold database, OIDC, and pilot signing secrets | No secrets in Git, images, website files, or deployment logs |
| Log Analytics and Azure Monitor | Central logs, readiness alerts, and audit evidence | Do not log tokens, clinical content, or raw imaging data |
| Azure Blob Storage, later | Quarantined DICOM and derived 3D assets | Add only with private endpoints, malware isolation, retention, and deletion controls |
| Azure Service Bus, later | Imaging and regulation jobs with retry/dead-letter handling | Add when workers replace current placeholders |
| Azure API Management, later | Clinic partner contracts, quotas, versions, and Layer8 policy enforcement | Add before external partner scale; unnecessary for the first private pilot |

## Request path

1. The browser loads the static dashboard from Hostinger.
2. Browser API calls go only to `https://api.virtuapet.com`.
3. Hostinger DNS maps `api.virtuapet.com` to Azure Container Apps using Azure's verified custom-domain instructions.
4. Container Apps terminates TLS and forwards port 8080 to the Fastify service.
5. The API validates OIDC tokens and server-owned clinic memberships.
6. The API reaches PostgreSQL over an encrypted, restricted connection.
7. The readiness endpoint returns `503` if identity configuration or the database is unavailable.

## Required runtime values

- `VIRTUAPET_ENV=production`
- `HOST=0.0.0.0`
- `PORT=8080`
- `PUBLIC_API_BASE_URL=https://api.virtuapet.com`
- `CORS_ALLOWED_ORIGINS=https://virtuapet.com,https://www.virtuapet.com`
- `DATABASE_URL` as a Key Vault-backed secret for a least-privilege application role
- `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URL` from the approved identity provider
- `CLINICAL_TWIN_SIGNING_KEY` as a Key Vault-backed engineering-pilot secret

`DEV_API_TOKEN` is prohibited. The current signing implementation uses HMAC and is not sufficient for a clinical release; a non-exportable asymmetric signing service and verification evidence remain mandatory before clinical authorization.

## Deployment sequence

1. Select the Azure subscription and a US region after checking current service availability and pricing.
2. Create separate resource groups for staging and production. Start with staging and synthetic records only.
3. Create PostgreSQL, private/restricted networking, TLS enforcement, backup retention, and distinct owner, migrator, and application roles.
4. Run all migrations with the migrator role, then run `scripts/verify-postgres.mjs` in staging.
5. Build the root `Dockerfile`, scan it, push a content-addressed image to Azure Container Registry, and deploy that exact digest to Container Apps.
6. Assign a managed identity and grant only image-pull, secret-read, logging, and required storage permissions.
7. Configure secrets and non-secret environment values. Never place secret values in shell history or committed parameter files.
8. Verify `/healthz`, `/readyz`, unauthenticated `401` responses, allowed-origin CORS, disallowed-origin CORS, database round trips, logs, alerts, and revision rollback.
9. Add the Azure-provided DNS verification record and API CNAME in Hostinger, bind the managed certificate, and repeat all checks through `https://api.virtuapet.com`.
10. Promote to production only after staging evidence passes. Production remains non-clinical until the Phase 3 external validation gates pass.

## Acceptance thresholds

- `/healthz` returns `200` from the running revision.
- `/readyz` returns `200` only when both OIDC configuration and PostgreSQL are available; otherwise it returns `503`.
- Protected endpoints return `401` without a valid bearer token.
- Browser CORS accepts only the two VirtuaPet website origins and rejects arbitrary origins.
- Migrations `001` through `004` apply successfully, and the persistent round-trip verifier passes.
- The database is not exposed to unrestricted public ingress.
- Secrets are absent from Git history, built web assets, image layers, application logs, and deployment output.
- A prior healthy Container Apps revision can be restored without rebuilding.
- Backup configuration is recorded; a restore drill must pass before live customer or clinic data is accepted.
- Raw DICOM, patient geometry, and clinical claims remain disabled until their separate privacy, security, validation, and device gates pass.

## Current setup status

As of 2026-09-15, staging revision `virtuapet-staging-api--a9f4854-http` runs the immutable image for commit `a9f4854` and receives 100% of API traffic. Previous revisions remain active at 0% as rollback targets. Azure PostgreSQL remains private, migrations 001-004 were applied by manual Container Apps jobs, and the API uses a secret-backed `virtuapet_app` connection. Direct and default-host checks passed for health, readiness, capabilities, authentication denial, and CORS.

Container Apps now uses HTTP `/healthz` for liveness and startup and HTTP `/readyz` for dependency-aware readiness. The active revision reported healthy after the probe change and both paths returned HTTP 200.

Updated check on 2026-09-15: `api.virtuapet.com` is bound with SNI and managed certificate `mc-api-virtuapet-com`; HTTPS health/readiness returned 200 and protected anonymous access returned 401. The first readiness probe timed out before a successful retry; no root cause was established. Hostinger website returned 200. The active revision remains `a9f4854-http`; the new integration slice is not deployed.

Remaining production gates include transaction migration and RLS on legacy tables, live Azure two-tenant tests, backup restore, alerts, authenticated workflow tests, and production authorization. The new transaction helper and nine disposable PostgreSQL isolation checks are local foundation evidence only. See [parallel integration rollout](INTEGRATION_ROLLOUT.md). API images are currently published to GHCR, not ACR; future ACR/Key Vault targets in this design are not evidence of completed managed-identity setup. Image publication is gated on complete CI and uses the exact tested commit; deploy by digest after isolated-revision validation.
