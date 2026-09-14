# VirtuaPet Phase 2 Pilot Acceptance Report

## Status

The first Phase 2 consumer and clinic pilot slice is implemented and locally testable. Phase 2 is not commercially or clinically complete because design-partner, production identity, persistent-database, privacy, accessibility, and live deployment evidence remain outstanding.

## Implemented slice

| Capability | Evidence | Status |
|---|---|---|
| Verified identity adapter | OIDC issuer, audience, signature, and JWKS verification | Implemented; live provider not configured |
| Development identity | Explicitly restricted to development environment | Implemented |
| Pet Profile | Guardian-bound create and read | Tested |
| Consent | Clinic scopes, purpose, start, expiry, list, and revocation | Tested with memory repository |
| Persistent schema | Pet, consent, FGS, regulation evidence, and outbox tables | Local PostgreSQL migration passed; CI verification configured |
| Persistent adapter | Parameterized PostgreSQL operations | Pet, consent, revocation, and FGS round trips passed locally; CI verification configured |
| Manual FGS | Five action units, trained-assessor confirmation, total, 4-of-10 review prompt | Tested |
| Clinic access | Veterinary role and active write consent required | Tested |
| Regulation evidence | Reviewer-only source record and unsupported fail-closed result | Tested |
| Dashboard | Phase 2 statuses and human-review notice | Implemented |

## Safety and claim boundaries

- FGS values are observations entered by a trained human. No camera model or diagnosis is present.
- A total score of four or more creates a veterinary-review prompt; it does not prescribe treatment.
- Regulation evidence is not a final compliance answer. Results remain drafts until human verification.
- OIDC organization claims must be mapped to server-owned memberships before production clinic authorization.
- No real household, clinic, patient, DICOM, location, payment, or nonprofit data is authorized in the current environment.

## Remaining Phase 2 exit evidence

- Three design-partner clinics complete defined workflows.
- Privacy and security owners approve the production identity and consent flows.
- PostgreSQL rollback, concurrency, row isolation, backup, restore, and Azure-hosted tests pass. The initial local migration and repository round trips have passed.
- Manual FGS content and workflow receive veterinary-owner approval.
- Regulation adapters use approved authoritative sources and record freshness, conflict, and human-verification states.
- Authenticated web workflows pass keyboard, screen-reader, mobile, and supported-browser testing.
- Azure development and Hostinger preview deployments pass health, readiness, rollback, secrets, logs, and alert checks.
