# VirtuaPet Phase 1 Threat Model

## Scope

This threat model covers the public web surface, API, identity boundary, Pet Profile, consent contracts, service events, and future Layer8 decision point. Clinical imaging, robotics, fleet operations, and payments require additional feature-specific models before pilot release.

## Trust boundaries

1. Browser to public edge.
2. Public edge to API Management.
3. API Management to service identity.
4. Service to Layer8 policy decision.
5. Service to owned database and event outbox.
6. Event backbone to consumers.
7. Asset ingestion to quarantine and trusted derivatives.

## Priority threats and controls

| Threat | Impact | Required control | Phase 1 evidence |
|---|---|---|---|
| Forged identity or role | Cross-user or cross-clinic access | Verified OIDC; memberships resolved server-side | Development endpoint requires token; production identity remains gated |
| Direct object reference | Disclosure of another pet | Owner or grant check; non-disclosing not-found response | API test covers unrelated guardian |
| Overbroad consent | Location or health disclosure | Enumerated scopes, purpose, expiry, revocation | Strict consent schema |
| Event replay or spoofing | Duplicate or false state | Signed service identity, idempotent consumer, outbox, event IDs | Versioned envelope contract |
| Malicious file or 3D asset | Code execution or unsafe rendering | Quarantine, parser isolation, limits, sanitization, signature | Target architecture only |
| Prompt injection in regulations | False compliance checklist | Approved sources, content isolation, policy checks, human verification | Target architecture only |
| Clinical model mismatch | Wrong patient, side, scale, or anatomy | Immutable lineage, exact match gates, clinician approval | Target architecture only |
| Location leakage | Physical safety and privacy harm | Private default, short-lived grants, log redaction | Consent boundary specified |
| Webhook forgery | Incorrect payment or entitlement | Signature, replay ledger, reconciliation | Existing Layer8 capability to verify before integration |
| Device takeover | Pet or human injury | Hardware identity, signed missions, local safe state | Future feature-specific model required |

## Phase 1 decision

The current header-based development identity is permitted only on a local workstation with synthetic data. It is a release blocker for any shared environment. No customer, pet health, clinical, precise-location, payment, or nonprofit data may be loaded before verified identity and persistent tenant isolation are implemented and tested.

