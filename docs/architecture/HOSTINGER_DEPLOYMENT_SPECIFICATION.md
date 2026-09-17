# VirtuaPet Hostinger-First Deployment Specification

## Status and decision

Document ID: `VP-ARCH-HOSTINGER-001`

Hostinger is the provider for the `virtuapet.com` domain and public website. The selected backend deployment is Azure Container Apps with Azure Database for PostgreSQL Flexible Server; see `AZURE_BACKEND_DEPLOYMENT.md`. Hostinger continues to own public DNS, while `api.virtuapet.com` points to the Azure ingress.

Current observation (2026-09-14): the apex, `www`, and `api` names returned no A or CNAME records. Domain activation is pending and must be checked again after Hostinger reports availability.

The existing application uses PostgreSQL-specific migrations and the `pg` driver. Hostinger managed SQL is MySQL and is not compatible with this application. VirtuaPet must not point the current application at Hostinger MySQL. Azure managed PostgreSQL avoids an application rewrite and removes routine database-server patching from the VirtuaPet team.

## Public layout

| Address | Host | Purpose | Data rule |
|---|---|---|---|
| `virtuapet.com` and `www.virtuapet.com` | Hostinger web or cloud hosting | Vite website and dashboard | No secrets or unrestricted clinical data in browser files |
| `api.virtuapet.com` | Hostinger Node.js app | Fastify API | Server-side values only; authenticated clinical routes |
| `staging.virtuapet.com` | Separate Hostinger application | Release verification | Synthetic data only |
| PostgreSQL private endpoint | Dedicated Hostinger VPS | PostgreSQL 16 system of record | Never publicly reachable on port 5432 |
| Imaging worker private endpoint | Dedicated Hostinger VPS or approved specialist provider | Future DICOM pixel processing | No public ingress; not implemented in Phase 3 |

## Hostinger deployment settings

- Use Node.js 22.x to match the repository engine requirement.
- Connect the GitHub repository and build from the repository root so npm workspaces can resolve `@virtuapet/contracts`.
- Website build command: `npm ci && npm run build --workspace=@virtuapet/contracts && npm run build --workspace=@virtuapet/web`.
- Website output directory: `apps/web/dist`.
- API build command: `npm ci && npm run build --workspace=@virtuapet/contracts && npm run build --workspace=@virtuapet/api`.
- API start command: `npm start`.
- Set `HOST=0.0.0.0`; use the `PORT` value supplied by Hostinger.
- Set `PUBLIC_API_BASE_URL=https://api.virtuapet.com`.
- Keep the website and API as separate Hostinger applications even if both use the same Git repository.

## Environment values and secrets

The authoritative variable names are in `.env.example`; its values are placeholders. Production values are entered into Hostinger's server-side environment-variable controls and never pasted into tickets, documentation, browser variables, build output, or Git.

Required API values:

- `VIRTUAPET_ENV=production`
- `DATABASE_URL`: TLS PostgreSQL connection string for a least-privilege application role.
- `PUBLIC_API_BASE_URL=https://api.virtuapet.com`
- `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URL`.
- `CLINICAL_TWIN_SIGNING_KEY`: unique per environment and at least 32 random bytes. This environment-secret mechanism is acceptable only for engineering pilots. Clinical release requires a managed or hardware-backed non-exportable signing key and rotation/audit evidence.

`DEV_API_TOKEN` is prohibited in staging and production. Variables beginning with `VITE_` are public browser configuration and must never contain secrets.

Required public web values for Microsoft Entra sign-in are
`VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, and
`VITE_ENTRA_API_SCOPE`. The registered SPA redirects must match
`https://virtuapet.com` and `https://www.virtuapet.com`. The API verifier uses
the signed Entra `oid` claim as the membership user UUID. A selected
`X-VirtuaPet-Organization-Id` is only tenant context; every protected route
must still verify active server-side membership before access.

## PostgreSQL on a Hostinger VPS

The database VPS is a separate machine and account boundary from the public web application. Acceptance requires all of the following:

1. PostgreSQL 16 is pinned, patched, and configured to listen only on a private or explicitly allow-listed interface.
2. Host firewall and PostgreSQL client rules deny all other sources; the database is not exposed to the public internet.
3. TLS is required and certificate validation succeeds from the API.
4. Separate owner, migrator, application, backup, and read-only roles use unique credentials and least privilege.
5. Production, staging, and development use separate databases and credentials.
6. Encrypted automated backups meet an initial 15-minute recovery-point target where feasible, and copies are stored outside the database VPS.
7. Quarterly restore drills prove a four-hour recovery-time target before either target becomes a customer promise.
8. Disk, memory, connections, replication/backup age, slow queries, certificate expiry, and failed logins are monitored and alerted.
9. Migration 003 and `scripts/verify-postgres.mjs` pass against staging before production migration.
10. Raw DICOM objects are not stored in PostgreSQL or ordinary website storage.

## Clinical-data boundary

The current Phase 3 code does not decode CT pixels, run a real segmentation model, extract patient geometry, or provide clinical validation. Until those capabilities and controls exist, Hostinger environments use synthetic data only. Future DICOM and derived assets require encrypted private object storage, malware isolation, retention/deletion controls, access audit, immutable lineage, and a verified disaster-recovery path. If Hostinger cannot provide those controls for the selected plan, use a specialized storage/security service without moving the public website away from Hostinger.

## Release gates

A release is not considered deployed merely because code was pushed or a Hostinger build completed. Record evidence for DNS and TLS, website hash, API `/healthz`, API `/readyz`, authenticated access denial, database migration and round trip, backup and restore, secret rotation, logs and alerts, rollback, dependency scan, and tenant-isolation tests.

Production clinical authorization additionally requires real pipeline implementation; representative, patient-separated and site-separated validation; veterinarian review; physical GibiWorld device testing; signing-key protection; privacy and security review; and an explicit clinical release decision.
