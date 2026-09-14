# VirtuaPet Full Architecture Specification

## Document control

| Field | Value |
|---|---|
| Document ID | VP-ARCH-001 |
| Version | 1.0 |
| Status | Target architecture with Phase 2 pilot implementation baseline |
| System | VirtuaPet commercial platform |
| Owners | Architecture, security, product, clinical safety, and operations |

## 1. Purpose

This specification defines the complete VirtuaPet platform and the boundaries required to build it safely. It preserves the dashboard as the common entry point while allowing each service to own its data and release independently.

Phase 1 implements contracts, a protected development API, a dashboard shell, health/readiness separation, tests, and build automation. The first Phase 2 slice adds OIDC verification, PostgreSQL persistence, consent lifecycle endpoints, manual FGS recording, and regulation evidence. Sections labeled target describe later work and are not claims of deployed capability.

## 2. Architecture principles

1. One canonical pet identifier connects authorized services.
2. Services own their records and never read another service database directly.
3. Access is denied unless identity, tenant, purpose, scope, and time are valid.
4. Clinical source data and derived models remain linked but separately immutable.
5. AI proposes; policy constrains; people approve safety-sensitive outcomes.
6. Every external rule, medical image, model, payment, location, and custody result carries provenance.
7. Runtime assets are quarantined, sanitized, signed, versioned, and entitled.
8. Product status is explicit: implemented, tested, pilot, planned, research, or unavailable.

## 3. System context

```text
Households       Clinics          Caregivers       Travel partners
     \              |                 |                   /
                    VirtuaPet surfaces
          Consumer web  VetOS  Mobile  GibiWorld
                              |
                  Azure Front Door and APIM
                              |
              Identity  Layer8 policy  Entitlements
                              |
 -----------------------------------------------------------------
 | Pet Graph | Clinic Graph | Health Vault | Travel | Twin Assets |
 | VetOS     | Rules        | Imaging      | Events | Audit       |
 -----------------------------------------------------------------
              |        |        |        |        |
          PIMS/PACS  Stripe  Shopify  Azure AI  Partner APIs

SugarDaddy.lgbt remains outside the commercial system boundary.
```

## 4. User surfaces

### 4.1 Consumer dashboard

The dashboard provides Overview, Pet Profile, Health, Care, PawPath, Judy travel, Pawsome3D assets, GibiWorld experiences, Shop, permissions, notifications, and privacy controls. Unavailable features show their release state rather than fabricated content.

### 4.2 VetOS

VetOS provides a clinic command center, patient search and matching, scheduling, communications, recalls, payment links, inventory foundations, manual FGS, regulation evidence, imaging cases, clinical-twin review, rehearsal sessions, staff permissions, and audit evidence.

### 4.3 GibiWorld

GibiWorld remains the specialized Unity and AR runtime. It consumes sanitized, signed, entitled derivatives. It does not receive unrestricted DICOM, payment credentials, regulatory secrets, or SugarDaddy.lgbt eligibility information.

## 5. Logical services

| Service | Responsibility | Owned data |
|---|---|---|
| Identity and tenancy | Users, households, organizations, roles, sessions | Identity mappings and memberships |
| Pet Graph | Canonical pet identity and shared profile | Pet core, identifiers, ownership links |
| Consent | Time-limited purpose-bound grants | Grants, scopes, revocations |
| VetOS | Clinic workflows | Appointments, clinic tasks, communications, inventory projections |
| Health Vault | Documents and normalized clinical summaries | Encrypted source documents and metadata |
| Imaging | DICOM ingestion and derived clinical twins | Studies, series, segmentations, measurements, approvals |
| Twin Asset Registry | Consumer and clinical 3D versions | Manifests, hashes, lineage, entitlements, rollback pointers |
| Rules | Address-to-jurisdiction and source evidence | Jurisdictions, rules, citations, freshness, conflicts |
| Travel | Trips, custody, welfare telemetry, partner settlement | Trip plans, events, incidents, settlement records |
| Device | Robot registration, policy, telemetry, updates | Devices, missions, safety events, firmware evidence |
| Commerce | Catalog synchronization and order references | Product mappings and non-card order references |
| Billing and entitlement | Layer8 and Stripe subscription boundary | Customers, plans, entitlements, webhook ledger |
| Audit | Append-only security and business evidence | Correlated immutable events |

## 6. Canonical identifiers

- Pet: UUIDv4 in Phase 1; migration to time-sortable UUID is allowed through an ADR.
- User, household, clinic, partner, device, study, asset, trip, grant, and event: independent identifiers.
- External identifiers are stored as provider, namespace, value, verification state, and timestamps.
- Microchip numbers are identifiers, not authentication factors.
- Clinical patient matching never relies on name alone.

## 7. Pet Profile contract

The Phase 1 contract contains name, species, optional birth date, optional microchip ID, guardian, timestamps, and record version. Medical observations, raw location, payment information, biometric media, clinical images, and nonprofit eligibility information are excluded from the core object.

Services link data through `petId`. They expose views through APIs and events. The Pet Graph may materialize authorized projections but does not become a copy of every service database.

## 8. Identity, authorization, and consent

### 8.1 Target identity flow

1. The edge validates issuer, audience, signature, expiration, nonce, and token type.
2. Identity resolves the external subject to a VirtuaPet user.
3. Organization membership resolves server-side.
4. Layer8 evaluates action, resource, relationship, purpose, risk, and policy version.
5. The owning service applies its resource rule.
6. Audit records allow, deny, or human-review outcome.

Client headers never grant authority. Phase 1's development token and user header are expressly local-only and must be replaced before any shared environment holds personal information.

### 8.2 Consent model

A grant contains grantor, grantee, pet, purpose, scopes, start, expiry, and revocation. Location is private by default. Caregiver permissions expire with the booking. Clinic access is limited to the organization and care purpose. A revoked or expired grant is denied immediately at the owning service and removed from cached decisions.

## 9. API conventions

- HTTPS only outside the local workstation.
- Base path `/v1`; breaking changes require a new major path or compatible migration.
- JSON uses UTF-8 and ISO 8601 UTC timestamps.
- Write requests accept an idempotency key where retries can duplicate effects.
- Every response includes a request ID.
- Errors use stable machine codes and safe human messages.
- Lists use cursor pagination.
- Object reads return not found when disclosure would reveal another tenant's resource.
- Health proves the process responds; readiness verifies required dependencies.

### 9.1 Phase 1 endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Process health |
| GET | `/readyz` | Configuration readiness |
| GET | `/v1/platform/capabilities` | Honest product-state registry |
| POST | `/v1/pets` | Create an owner-bound Pet Profile |
| GET | `/v1/pets/{petId}` | Read an owner-bound Pet Profile |

## 10. Event architecture

Azure Service Bus is the target durable event backbone. Each envelope includes event ID, versioned type, occurrence time, actor, correlation ID, optional pet ID, schema version, and data.

Examples include `virtuapet.pet.created.v1`, `virtuapet.consent.revoked.v1`, `virtuapet.twin.approved.v1`, and `virtuapet.trip.custody_transferred.v1`.

Consumers are idempotent. An outbox is written in the same transaction as the owning record. Dead-letter queues have owners, alerts, replay controls, and retention. Personal data is minimized in events; consumers retrieve authorized details from the owner.

## 11. Data architecture

### 11.1 Target stores

- Azure Database for PostgreSQL for transactional service data.
- Azure Managed Redis for short-lived cache, locks, and rate limits, never as the only system of record.
- Azure Blob Storage for encrypted documents, DICOM, derived models, evidence, and exports.
- Azure Service Bus for commands and domain events.
- A vector index only for approved source retrieval; it is not an authority database.

### 11.2 Data classes

| Class | Examples | Minimum handling |
|---|---|---|
| Public | Marketing and approved product documentation | Integrity and publishing control |
| Internal | Plans, operational metrics | Staff role controls |
| Confidential | Household, clinic, trip, precise location | Encryption and purpose-bound access |
| Restricted clinical | DICOM, medical documents, derived anatomy | Separate keys, detailed audit, limited export |
| Restricted nonprofit | Applications, hardship, donor and grant decisions | Separate SugarDaddy.lgbt systems and governance |

Retention is defined per record class and jurisdiction. Deletion uses a workflow that accounts for backups, legal holds, clinical retention obligations, event tombstones, and derived assets.

## 12. DICOM and clinical digital-twin architecture

### 12.1 Service boundary

The imaging service is isolated from consumer asset generation. It accepts approved DICOM transfer, validates the complete series, quarantines files, and records source hashes. It never silently combines patients, laterality, studies, or incompatible spacing.

### 12.2 Derived model lineage

```text
Study -> Series -> Volume -> Segmentation -> Mesh -> Clinical Model
      -> Plan -> Rehearsal Session -> Approval or Rejection
```

Every node records parent IDs, tool and model version, parameters, operator, timestamp, units, coordinate frame, quality results, and approval state. Derived artifacts are immutable. Corrections create a new version.

### 12.3 Release state machine

`received -> quarantined -> validated -> reconstructed -> segmented -> clinician_review -> approved -> packaged -> rehearsed -> archived`

Failure, rejection, or supersession can occur at defined transitions. Only `approved` models may be packaged for rehearsal. Any patient, laterality, unit, coordinate, or source mismatch is terminal until corrected through a new traceable version.

### 12.4 Accuracy and effectiveness

The intended use defines the anatomy, modality, acquisition constraints, measurements, and acceptable error. Required metrics include patient/laterality match, spacing and orientation preservation, surface distance, landmark error, measurement error, topology defects, missing critical structures, clinician correction time, approval rate, rehearsal task completion, and usability.

Initial cross-cutting gates are documented in the phased plan. Procedure-specific gates may only become stricter. Dataset splits occur by patient and site. Performance is reported by species, breed/body size, scanner/site, acquisition protocol, and relevant pathology; aggregate performance alone cannot hide a failing subgroup.

## 13. Spatial asset architecture

The Twin Asset Registry stores immutable source, geometry, texture, rig, animation, behavior, and device-delivery versions. Runtime GLB and KTX2 derivatives include physical scale, axes, provenance, hash, signature, entitlement, supported device profile, and rollback target.

The manifest pointer may change atomically to a previously verified version. Clients verify signatures and compatibility before activation. Clinical and consumer assets use separate namespaces, entitlements, processing policies, and retention.

## 14. Layer8 integration

Layer8 is the shared API and AI governance plane. Reuse its verified Stripe webhook, customer billing, entitlement, API-key, routing, rate-limit, caching, and audit capabilities where they exist. Add SALTI intent, Arkham review, BEAVE operational learning, and human escalation only after production identity and policy integration.

Layer8 must return a signed decision containing subject, action, resource, tenant, purpose, policy version, outcome, obligations, expiry, and decision ID. Clinical decisions, regulatory conclusions, refunds, high-impact travel exceptions, and device safety overrides require bounded tools and defined human approval.

## 15. Smart Global Vet Link

The rules service resolves a normalized address into country, region, locality, and special zones. A source adapter retrieves authoritative material and records publisher, URL, title, retrieved time, effective date, checksum, geographic scope, species scope, and conflict state.

Layer8 may summarize approved evidence, but it cannot invent a rule. Results display sources, age, uncertainty, and unresolved conflicts. High-risk or stale results require human review. The system stores the rule version used for each trip checklist.

## 16. Feline Grimace Scale

Phase 2 implements a manual clinician or trained-staff workflow. The five action units, total, observer, training status, context, time, reassessment, and action are stored as observations. The product does not call the result a diagnosis.

Any future camera model is a new validated component with consent, image-quality rejection, subgroup performance, uncertainty, drift monitoring, human confirmation, and rollback. It cannot overwrite a human score.

## 17. Robot and fleet architecture

The cloud sends bounded signed missions, not raw motor commands. The robot maintains local safety control during cloud or network failure. Device identity uses hardware-backed credentials where available. Firmware is signed, staged, monitored, and reversible.

Travel uses trip, vehicle, handler, pet, crate or cabin, route, welfare plan, custody event, telemetry, communication, exception, incident, and settlement records. Custody transfers require both parties or an approved exception workflow. Live-pet drone transport is outside scope.

## 18. Commerce and payment boundaries

Stripe payment data stays within Stripe-hosted collection and the existing signed webhook architecture. VirtuaPet stores provider references, state, totals, and entitlement results, not raw card data. Shopify remains the commerce catalog and fulfillment boundary where used. Webhooks are signature-verified, idempotent, replay-protected, ordered through a ledger, and reconciled.

## 19. Deployment architecture

### 19.1 Target Azure platform

- Azure Front Door and Web Application Firewall at the public edge.
- Azure API Management for API policy, versioning, quotas, and observability.
- Azure Container Apps for APIs, Layer8, and workers.
- Azure PostgreSQL, Managed Redis, Service Bus, Blob Storage, Key Vault, and Monitor.
- Managed identities and private endpoints where supported.
- Separate development, staging, and production subscriptions or resource boundaries.

### 19.2 Hostinger

Hostinger serves the approved VirtuaPet web build and manages the public domain boundary. It does not store unrestricted clinical images or database secrets. DNS, certificates, caching, deployment artifact hash, rollback, and environment configuration are recorded for each release.

## 20. Security requirements

- Threat model every trust boundary and high-impact feature.
- Encrypt in transit and at rest; use separate keys for restricted clinical assets.
- Store secrets in Key Vault, never repositories or browser bundles.
- Verify service identity and least privilege.
- Scan dependencies, containers, IaC, secrets, and uploaded files.
- Rate-limit by authenticated subject, tenant, route, and risk.
- Require step-up authentication for exports, ownership changes, billing administration, and sensitive grants.
- Log access without placing secrets, raw tokens, DICOM pixels, or precise location in logs.
- Test tenant isolation, insecure direct-object reference, replay, confused deputy, prompt injection, malicious assets, and webhook forgery.

## 21. Reliability and recovery

Initial targets are 99.9% monthly availability for core profile and consent reads, recovery point objective of 15 minutes, and recovery time objective of four hours. These are engineering targets, not contractual commitments.

Every service defines timeout, retry, circuit-breaker, idempotency, queue, degraded-mode, backup, restore, and rollback behavior. Clinical rehearsal fails closed when asset signature, entitlement, scale, laterality, or source lineage cannot be verified.

## 22. Observability

Metrics, logs, and traces carry request and correlation IDs. Dashboards separate web availability, API health, readiness dependencies, authentication failures, authorization denials, queue depth, job age, event dead letters, storage errors, clinical pipeline stages, model QA failures, travel exceptions, robot safety events, and billing reconciliation.

Alerts identify owner, severity, customer impact, runbook, and escalation. Analytics never converts seeded records into user counts.

## 23. Testing strategy

| Layer | Required tests |
|---|---|
| Contract | Schema compatibility, invalid input, versioning |
| Unit | Domain rules and state transitions |
| Repository | Persistence, transaction, concurrency, row isolation |
| API | Authentication, authorization, validation, idempotency, error safety |
| Event | Outbox, duplicate, ordering assumption, dead letter, replay |
| Integration | Identity, Layer8, Stripe, PIMS, PACS, Shopify, source adapters |
| Security | Tenant escape, forged token, injection, malicious upload, signed asset |
| Clinical | Dataset integrity, accuracy, subgroup, correction, traceability |
| Device | Simulation, hardware-in-loop, network loss, sensor fault, safe stop |
| User | Accessibility, browser, mobile, clinic workflow, rehearsal usability |
| Recovery | Backup restore, regional failover, rollback, key rotation |

## 24. Repository and delivery standards

- `main` is protected; work lands through reviewed pull requests.
- Conventional commits and architecture decision records capture material change.
- Generated files, dependencies, secrets, clinical data, and customer exports are not committed.
- CI runs clean install, type checks, tests, builds, dependency review, secret scanning, and artifact checks.
- Releases are immutable and promoted by digest.
- `HANDOFF.md` is updated with each material implementation milestone.

## 25. Phase 2 implementation mapping

| Requirement | Current implementation | Next production step |
|---|---|---|
| Pet contract | `packages/contracts` and pet API | Compatibility policy and production database verification |
| Consent contract | Contract plus create, list, and revoke endpoints | Cache invalidation and durable audit outbox |
| Event envelope | `packages/contracts` | Transactional outbox and Service Bus |
| API boundary | OIDC verifier plus development-only fallback | Server-owned organization membership and Layer8 decisions |
| PostgreSQL | Migration and repository adapter | Integration, RLS, backup, restore, and Azure verification |
| Manual FGS | Trained assessor, role, active consent, total, review prompt | Veterinary content approval and pilot evidence |
| Rules evidence | Reviewer-only evidence and unsupported fail-closed response | Address resolution, adapters, verification, supersession |
| Dashboard | `apps/web` Phase 2 pilot shell | Authenticated data and accessibility suite |
| Honest status | Capability registry | Admin-controlled release registry |
| Testing | Contract and API suites | Integration, security, browser, recovery tests |

## 26. Architecture acceptance

The architecture is accepted for implementation when product, security, clinical, operations, and engineering owners approve the boundaries; every proposed feature has an owner and evidence gate; and Phase 1 production gaps are scheduled. Approval does not certify a clinical device, transport operator, aircraft operation, or autonomous robot.
