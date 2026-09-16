# VirtuaPet Master Architecture Specification

**Document ID:** VP-ARCH-001
**Version:** 6.0
**Date:** 2026-09-16
**Status:** Canonical build specification / implementation baseline
**Product family:** VirtuaPet consumer platform + VirtuaPet VetOS + shared platform services
**Design system:** Sahara — Warm Minimalism ("Sun-Baked Simplicity") & Sovereign Orbital Telemetry Matrix
**Primary deployment:** Microsoft Azure + Hostinger
**Shared infrastructure:** Layer8 Adaptive gateway + Stripe
**Related systems reused:** Stelar, Pawsome3D, PawPath, Judy, GibiWorld, Layer8
**Nonprofit boundary:** SugarDaddy.lgbt remains legally and operationally separate

---

## 0. Executive Summary

VirtuaPet is a unified companion-animal platform with two tightly integrated commercial surfaces:

1. **VirtuaPet Consumer** — the owner-facing product for sovereign pet identity, telemetry, wellness surveillance, walking/kinetics, care, travel command, translation, digital twins, augmented reality, personalized products, shopping, and emergency/lost-pet workflows.
2. **VirtuaPet VetOS** — a multi-tenant B2B SaaS operating system for veterinary clinics covering administration, client scheduling, staff scheduling, billing automation, retention, vendor management, inventory, a dedicated supply-and-equipment procurement marketplace, pricing and overhead planning, AI voice/email customer service, licensing/compliance assistance, and digital-twin clinic operations.

Version 6.0 adds two purpose-built marketplaces without reusing the former retail storefront: a clinic procurement marketplace for veterinary supplies and equipment, and a consumer services marketplace for day care and overnight stays. The two marketplaces have separate identities, catalogs, workflows, ledgers, search indexes, disputes, permissions, and provider governance. Shopify is not part of either architecture.

In Version 5.0, the visual, spatial, and interaction design language across the entire platform is unified under the **Sahara Design System** ("Sun-Baked Simplicity") and the **Sovereign Orbital Twin & Telemetry Matrix** architecture developed in `stitch_virtuapet_care_platform`. This merges warm, disciplined minimalism (terracotta/sienna accents, warm linen surfaces, editorial EB Garamond serif headlines, clean Manrope body typography, and Space Grotesk cryptographic telemetry) with high-density, real-time clinical and biometric dashboards.

The platform is built around two durable graphs:

- the **Pet Graph**, centered on one persistent `pet_id` anchored to a sovereign decentralized identifier (`DID:PET:<id>`);
- the **Clinic Operating Graph**, centered on one persistent `tenant_id` / `clinic_id`.

The two graphs exchange information strictly through explicit, purpose-bound cryptographic permission grants and zero-knowledge proofs. A veterinary clinic never receives unrestricted access to a consumer account merely because both products belong to VirtuaPet.

The merged system reuses prior engineering where it is already strong:

- **Layer8** remains a separate Python/FastAPI service and provides governed AI execution, Stripe subscription lifecycle support, API-key management, entitlements, rate limiting, policy/plugin hooks, caching, routing, and AI audit telemetry.
- **Stelar** contributes the pet wellness baseline/anomaly model, Pawprint ID biometric concepts, pgvector usage, Azure deployment heritage, digital-twin health presentation, and existing web/API patterns.
- **GibiWorld** remains the authoritative Unity spatial runtime for consumer AR and the secure Pawsome3D asset runtime.
- **Pawsome3D** contributes reusable 3D processing techniques and pet visual identity assets. Its former merchandise storefront and order model are not reused by the new marketplaces.
- **PawPath** becomes the `Go` domain: walking, kinetic ridge traces, route planning, activity, pack walks, hazards, and neighborhood safety intelligence.
- **Judy** becomes the `Care`, `Travel`, and `Translate` domains (Care & Travel Command).
- **SugarDaddy.lgbt** stays separate, with a consent-based referral bridge from VirtuaPet.

The deployment standard is:

- **Hostinger** for public web surfaces and static/Node-capable frontend delivery.
- **Azure Front Door + WAF** for protected API ingress.
- **Azure API Management** as the public application API gateway.
- **Azure Container Apps** for application APIs, Layer8, workers, integration services, and selected jobs.
- **Azure Database for PostgreSQL Flexible Server** as the primary transactional store.
- **Azure Managed Redis** for cache, rate limits, locks, ephemeral workflow state, and hot session state.
- **Azure Service Bus** for domain events and asynchronous workflows.
- **Azure Blob Storage** for documents, media, generated assets, immutable evidence, and model packages.
- **Azure Key Vault** for secrets, certificates, and privileged keys.
- **Azure Container Registry** for production images.
- **Application Insights + Log Analytics** for metrics, traces, logs, alerts, and operational evidence.
- **Stripe** for subscription billing and selected platform payments.
- **VirtuaPet Marketplace Services** for veterinary procurement and consumer care bookings, with separate domain ledgers and Stripe-hosted payment collection.
- **Azure Communication Services / pluggable providers** for email, SMS, and voice transport.
- **Layer8** for all governed LLM execution and AI usage accounting.

The core architectural rule is:

> **VirtuaPet is one platform with shared identity, contracts, permissions, billing entitlements, events, and audit primitives — presented through an editorial luxury aesthetic of sun-baked simplicity and high-precision sovereign telemetry.**

---

# 1. Scope

## 1.1 Consumer product scope

VirtuaPet Consumer includes:

- **Sovereign Access & Authentication:** Air-gapped biometric login, WebAuthn/Passkeys, Ed25519 pet parent credentials, Apple Touch ID/YubiKey/NFC collar tap, dual sign-in/vault creation;
- **Sovereign Orbital Dashboard:** Sahara global shell, central orbital 3D volumetric photogrammetric twin, radar sweep, real-time kinetic telemetry HUD, and 4 docked glass-card feature modules;
- **Health & ID Passport:** Cryptographically verified clinical health ledger, ISO 11784/11785 FDX-B microchip ledger, zero-knowledge proof generator, rabies FAVN antibody titer assay verification, immunization bento table, longitudinal clinical history, and prescription supplement protocol;
- **Care & Travel Command:** Sovereign aviation manifest, FAA 8400-3 and IATA live-animal certifications, JSX/commercial cabin transit clearances, Hawaii DAR-5 / DEFRA / EU Annex IV international transit dossiers, real-time handler dispatch, live audio links, smart collar clasp controls, and 24/7 global emergency enclave;
- **Digital Profile & Traces:** 4.8M polygon LiDAR photogrammetric 3D twin, volumetric/wireframe/gait IK view modes, 360° rotation dial, kinetic ridge traces (sub-meter RTK GPS), metabolic energy dissipation curves, environmental acoustic/UV sensor logs, peer-to-peer BLE pack encounters, and USDZ/GLTF model exports;
- **Companion Telemetry Onboarding Gateway:** 4-step milestone progress sequence (Companion Identity, Biometric Ledger, Hardware & Mesh Pairing, Travel/Diets/Clinical Sync), breed morphology architecture, sighthound deep-chested skeletal guide, sub-GHz 915MHz collar pairing, and home anchor geofencing;
- **Veterinary Document Vault & EMR Linkage:** End-to-end encrypted medical records, bidirectional clinical sync, and Dr.-signed Merkle proof verification;
- **Mobility & Walking (Go):** PawPath-derived intelligent walking, kinetic sprint corridors, circular routes, hazard reporting, and privacy-truncated trails;
- **Pawsome3D Experiences:** nonclinical pet-likeness models, PawPrint artwork, and approved interactive assets; no retail-store reuse;
- **Care Services Marketplace:** verified day-care and overnight provider discovery, pet eligibility, availability, booking, time-limited care consent, custody evidence, incidents, refunds, disputes, reviews, and provider payouts;
- **GibiWorld AR Companion:** Authoritative Unity spatial runtime, real-time fixed-rate locomotion, and single-anchor AR composition;
- **Emergency & Lost-Pet Beacon:** 1-tap ER dispatch, high-decibel collar pulse beacon, and geofence breach auto-escalation;
- **Consent-based SugarDaddy.lgbt Referral:** Air-gapped financial hardship support.

## 1.2 VetOS scope

VirtuaPet VetOS includes:

- **Sahara Clinic Command Dashboard:** Multi-location administrative console, real-time clinical triage HUD, active patient queue, doctor/staff utilization gauges, emergency room capacity, and incoming telemetry radar;
- **Multi-Resource Scheduling Engine:** Real-time conflict-free booking matrix triple-binding doctor availability, room capacity, and equipment constraints with sub-second Redis locks;
- **Patient Biometric Dossier & ZK-Health Card Reader:** One-tap scan of consumer FDX-B microchips and ZK-passport QR codes, instant validation of rabies titers, allergies, and vitals without data leaks;
- **Omnichannel AI Voice Receptionist & Triage Stream:** Real-time PSTN/SIP call automation, sentiment/urgency classification, live transcription stream, automated appointment hold generation, and instant human handoff;
- **Clinical Workforce & Shift Orchestrator:** Dynamic shift scheduling, role-coverage verification (DVM, LVT, tech), time-off management, and fatigue/workload analytics;
- **Client Retention & Recall Automation:** Automated lifecycle recall journeys (vaccines, senior wellness, dental, post-op check-in) with separated marketing/transactional consent gates;
- **Inventory Ledger & Smart Cabinet HUD:** Immutable event-sourced inventory ledger, batch/lot tracking, expiry exposure forecasting, automated PO generation, and DEA controlled-substance dual-signature logs;
- **Vet Procurement Marketplace:** Clinic-only sourcing for veterinary supplies, consumables, equipment, service contracts, parts, and qualified PSI manufacturing, with vendor verification, quotes, approvals, purchase orders, receiving, lot/serial capture, recalls, warranties, returns, and disputes;
- **Pricing Simulation & Overhead Allocation:** Direct cost vs true cost modeling, contribution margin analysis, wage/supplier inflation stress-testing, and service fee optimization;
- **Compliance Evidence Vault & Jurisdictional Watchdog (Command Tier):** Automated tracking of facility licenses, veterinary DEA/state registrations, OSHA/SDS safety logs, radiology badges, and inspection-readiness scorecards;
- **Digital Twin Clinic Spatial Map (Command Tier):** Interactive 2D architectural floor plan and 3D glTF/IFC spatial layout showing real-time room occupancy, equipment tracking, inventory bin mapping, and maintenance work orders;
- **PIMS/EMR Bi-directional Synchronization:** Overlay integration engine supporting IDEXX Neo, Cornerstone, Covetrus Pulse, ezyVet, and Hippo Manager without clinical data corruption.
- **Clinical Digital Twin, Surgical Planning & PSI (In Development):** DICOM CT/MR ingestion creates the anatomical twin; PIMS encounters, laboratory results, and longitudinal health records enhance a versioned clinical digital twin for measurements, implant-template exploration, protected GibiWorld AR rehearsal, surgical planning, and controlled patient-specific instrument design with mandatory veterinary and manufacturing approval.
- **Feline Grimace Scale Workflow (In Development):** Structured 0-10 acute-pain observations, trend tracking, reassessment timers, and a clinician-review trigger at 4 or more; no autonomous analgesia or unvalidated chatbot scoring.
- **Smart Global Vet Link (In Development):** Address-, route-, species-, date-, and purpose-aware regulatory checklists using traceable government sources, change monitoring, conflict detection, and mandatory professional review.

## 1.3 Explicit non-goals

Initial releases are not:

- an autonomous veterinary diagnostic system;
- a substitute for veterinary judgment;
- an autonomous prescription/medication system;
- an unrestricted medical-record editing agent;
- a general legal-advice system;
- a claim that software itself guarantees regulatory compliance;
- a mandatory rip-and-replace veterinary PIMS migration;
- a public map of private pet-owner residences;
- an unrestricted autonomous purchasing agent;
- an AI system allowed to directly spend clinic money above policy thresholds;
- reuse of the former retail store, retail catalog, retail orders, or Shopify for either marketplace;
- promotion of a visual or AR display mesh into a patient-specific instrument manufacturing master;
- a system that mixes SugarDaddy applicant data with commercial advertising or profiling.

---

# 2. Design System: Sahara — Warm Minimalism & Telemetry Matrix

The visual and interactive foundation of VirtuaPet v5.0 is derived directly from the design artifacts in `stitch_virtuapet_care_platform`.

```
       +-------------------------------------------------------------------------+
       |               SAHARA DESIGN FOUNDATIONS ("Sun-Baked Simplicity")        |
       +-------------------------------------------------------------------------+
       |   North Star: Luxurious warmth meets disciplined minimalism.            |
       |   Golden tones, editorial serif headings, and abundant whitespace.       |
       +------------------------------------+------------------------------------+
                                            |
                    +-----------------------+-----------------------+
                    v                                               v
       +----------------------------+              +----------------------------+
       |   Light Sahara Mode        |              |   Dark Sahara Orbital Mode |
       |   (Consumer & Clinic Day)  |              |   (Telemetry HUD & Twin)   |
       +----------------------------+              +----------------------------+
       | Background: Linen #faf5ee  |              | Background: Dark #120d0a   |
       | Surface Low: #f6f0e8       |              | Surface Subtle: #201a15    |
       | Surface Lowest: #ffffff    |              | Surface Card: #241d18      |
       | Text: Warm Cocoa #3a302a   |              | Text: Warm Linen #faf5ee   |
       | Borders: Warm Gray #d8d0c8 |              | Glass: rgba(28,21,18,0.78) |
       +----------------------------+              +----------------------------+
```

## 2.1 Color Palette and Theme Tokens

The entire palette is warm-shifted—even neutral grays feature warm terracotta undertones.

```css
:root {
  /* Sahara Brand Core */
  --color-primary: #c2652a;                 /* Burnt sienna — warm, earthy CTAs & focus */
  --color-primary-container: #e08850;       /* Terracotta midtone */
  --color-primary-bright: #f0a878;          /* Sunlit peach / accent highlight */
  --color-accent-sand: #dfaf85;             /* Warm golden sand */
  --color-accent-gold: #e5a953;             /* Desert amber / verified badge */
  --color-tertiary: #8c3c3c;                /* Dusty rose / emergency beacon */
  --color-tertiary-container: #d47070;      /* Muted rose highlight */

  /* Sahara Light Surfaces (Warm Linen) */
  --color-surface: #faf5ee;                 /* Warm linen base — never cold white */
  --color-surface-container-lowest: #ffffff;/* Pristine card surface */
  --color-surface-container-low: #f6f0e8;   /* Soft linen layer */
  --color-surface-container: #f2ece4;       /* Subtle neutral container */
  --color-surface-container-high: #ece6dc;  /* Elevated container */
  --color-surface-container-highest: #e6e0d6;/* Border / pill fill */
  --color-surface-dim: #dcd6cc;             /* De-emphasized surface */
  --color-on-surface: #3a302a;              /* Deep espresso cocoa body */
  --color-on-surface-variant: #605850;      /* Warm muted slate/charcoal */
  --color-outline: #9a9088;                 /* Muted border */
  --color-outline-variant: #d8d0c8;         /* 60% opacity hairline divider */

  /* Sahara Dark Surfaces (Deep Obsidian & Terracotta Glow) */
  --color-dark-bg: #120d0a;                 /* Deep charcoal obsidian base */
  --color-dark-surface: #181310;            /* Dark operating surface */
  --color-dark-surface-subtle: #201a15;     /* Subtle container */
  --color-dark-surface-card: #241d18;       /* Docked card fill */
  --color-dark-surface-highest: #2e241e;    /* Elevated HUD element */
  --color-dark-outline: #4a3b31;            /* Dark bronze hairline */
  --color-dark-on-surface: #faf5ee;         /* Crisp linen text */
  --color-dark-on-surface-variant: #cec6be; /* Warm muted silver */

  /* Status Colors (Warm Harmonics) */
  --color-status-verified: #059669;         /* Warm emerald green */
  --color-status-verified-bg: #ecfdf5;      /* Emerald tint */
  --color-status-pending: #d97706;          /* Warm desert amber */
  --color-status-alert: #c0392b;            /* Terracotta crimson */
  --color-status-alert-bg: #fce4e0;         /* Crimson tint */

  /* Shadows & Elevation */
  --shadow-warm-soft: 0 2px 16px rgba(58, 48, 42, 0.04);
  --shadow-warm-card: 0 4px 24px rgba(58, 48, 42, 0.06);
  --shadow-warm-elevated: 0 12px 36px rgba(58, 48, 42, 0.09);
  --shadow-dark-glass: 0 16px 36px -10px rgba(0, 0, 0, 0.75), 0 0 24px -8px rgba(194, 101, 42, 0.22);
}
```

## 2.2 Typography Hierarchy

The typographic pairing creates an editorial luxury aesthetic balanced with technical precision:

| Usage | Font Family | Weight | Tracking / Leading | Notes |
|---|---|---|---|---|
| **Headlines / Page Titles** | `EB Garamond`, serif | 400 (Regular), 600 (Semibold), Italic | Tight leading (`leading-[1.08]`), tracking tight | Elegant, literary editorial serif with italic emphasis words |
| **Section Titles / Sub-headings** | `EB Garamond`, serif | 500, 600 | Leading-tight, font-normal to semibold | Pairs with terracotta italic accents (e.g. `Health & <span class="italic text-primary">ID</span>`) |
| **Body Text / Explanations** | `Manrope`, sans-serif | 300 (Light), 400 (Regular), 500 (Medium) | Normal tracking, relaxed leading | Geometric, modern, warm, ultra-legible contrast to serif |
| **HUD Labels / Navigation** | `Manrope` / `Montserrat` | 600, 700 (Bold) | Uppercase, wide tracking (`tracking-wider` to `0.2em`) | Clean structural badges, step progress, button text |
| **Cryptographic / Telemetry** | `Space Grotesk`, monospace | 500, 600, 700 | Monospace tracking, tight | Transponder IDs, RTK coordinates, BPM, Titers, ZK-digests |
| **Icons** | `Material Symbols Outlined` | 100–700, Fill 0/1 | Standard sizing 14px to 24px | Crisp architectural icon iconography |

## 2.3 Key UI Components & Styling Patterns

### Glass-Card and HUD Badges
```css
.glass-card {
  background: rgba(28, 21, 18, 0.78);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(194, 101, 42, 0.22);
  box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.75), 0 0 24px -8px rgba(194, 101, 42, 0.22);
}
.glass-card:hover {
  box-shadow: 0 20px 42px -10px rgba(0, 0, 0, 0.85), 0 0 32px -4px rgba(224, 136, 80, 0.32);
  border-color: rgba(224, 136, 80, 0.45);
}
.hud-badge {
  background: rgba(22, 16, 13, 0.9);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(194, 101, 42, 0.32);
}
```

### Warm Light Surface Cards
```css
.sahara-card {
  background: var(--color-surface-container-lowest);
  border-radius: 1rem;
  padding: 1.75rem;
  border: 1px solid var(--color-outline-variant);
  box-shadow: var(--shadow-warm-soft);
  transition: all 0.2s ease-in-out;
}
.sahara-card:hover {
  box-shadow: var(--shadow-warm-card);
  border-color: var(--color-primary-bright);
}
```

---

# 3. Product Surfaces and Domain Architecture

## 3.1 Domain Layout

```text
virtuapet.com
    Public consumer showcase
    Consumer authenticated PWA / Web experience (Sahara Global Shell)

www.virtuapet.com
    Canonical alias to virtuapet.com

vet.virtuapet.com
    VirtuaPet VetOS clinic command dashboard

admin.virtuapet.com
    Restricted VirtuaPet platform governance console
    Azure-hosted, private VNet ingress

api.virtuapet.com
    Azure Front Door Premium + WAF -> Azure API Management

assets.virtuapet.com
    Signed/controlled asset delivery via Azure CDN / Blob Storage

status.virtuapet.com
    Public platform health & status telemetry

sugardaddy.lgbt
    Independent nonprofit surface, air-gapped data plane
```

## 3.2 Consumer Sahara Navigation

Global Slim Operating System Bar (Header):

```text
[Emblem + VirtuaPet] [Kona's Twin Active • BLE 5.4 • 94%] --- [Dashboard | Health & ID | Care & Travel | Digital Profile | Shop] --- [Emergency Beacon] [Pet Avatar Switcher]
```

Bottom Floating Telemetry Dock:

```text
[ Live Telemetry | Trail Map | Clinical Logs | 3D Studio ] --- [ Telehealth Vet Call ]
```

## 3.3 VetOS Sahara Clinic Navigation

Global Slim Operating System Bar (Header):

```text
[VetOS Emblem + Clinic Name] [Location: Presidio West #1] [Sync: PIMS IDEXX Active] --- [Quick Search: Client, Microchip, DID] --- [Emergency Intake] [Staff Profile]
```

Left Sahara Command Rail (Collapsible or 64px/240px wide):

```text
Today (Command Center)
Schedule (Multi-Resource Matrix)
Clients & Patients (Biometric Dossier)
Clinical Operations (Triage & Flow)
Automations (Recalls & Retention)
Inventory (Ledger & Smart Cabinet)
AI Communications (Voice/Chat/Email)
Planning & Financials (Overhead/Margins)
Compliance Vault (Rule Packs & Evidence)   [Command Tier]
Clinic Digital Twin (Spatial Facility)      [Command Tier]
Settings & Integrations
```

---

# 4. Architectural Principles

## 4.1 One Canonical Pet

A pet is created once and identified by a permanent `pet_id` paired with a decentralized identifier `DID:PET:<uuid>`. All consumer modules, biometrics, 3D meshes, travel manifests, and clinic permissions reference this single record.

## 4.2 One Clinic Operating Graph

A single physical clinic event affects scheduling, staffing, room occupancy, equipment allocation, inventory consumption, financial margins, and digital twin state simultaneously.

## 4.3 Explicit Service Contracts

No direct cross-service table joins. Inter-service data sharing occurs via gRPC/REST contracts and typed asynchronous domain events.

## 4.4 Events for Asynchronous Consequences

High-throughput actions emit durable domain events across Azure Service Bus via the Outbox Pattern.

## 4.5 Deterministic Systems Own High-Impact Actions

AI acts strictly as an advisory copilot (transcribing, drafting, proposing, triaging). Deterministic code strictly owns:
- Financial transactions & Stripe payouts;
- Booking confirmations & calendar locks;
- Inventory deductions & DEA double-signs;
- Regulatory compliance filings;
- Medication dosage records & prescription approvals.

## 4.6 Purpose-Bound Cryptographic Privacy

Every privileged data read requires:
```text
actor_id + tenant_or_household_id + purpose + resource_id + permission_grant_id + timestamp
```

---

# 5. Existing Build Reuse Matrix

| Module | Origin | Strategy | Architectural Role |
|---|---|---|---|
| **Layer8** | `robs46859-eng/layer8` | KEEP & ADAPT | Governed AI gateway, model routing, prompt policy packs, PII scrubbing, Stripe checkout & subscription synchronization. |
| **Stelar** | `robs46859-eng/stelarhost` | REUSE & MIGRATE | Wellness anomaly model, Pawprint ID biometric vectors (pgvector), continuous telemetry sampling, health presentation patterns. |
| **GibiWorld** | `robs46859-eng/gibiworld` | KEEP & INTEGRATE | Authoritative Unity spatial engine, fixed-rate locomotion, deterministic AR physics, single-anchor scene composition. |
| **Pawsome3D** | Internal repo | REUSE SELECTIVELY | 3D photogrammetric mesh reconstruction, PawPrint art generator, and Blender asset validation. Do not reuse its retail catalog, store, order, or fulfillment model. |
| **PawPath** | Internal repo | MERGE INTO `Go` | Kinetic sprint corridors, GPS walking routes, community packs, hazard alerts, privacy-masked start/end coordinates. |
| **Judy** | Internal repo | MERGE INTO `Care/Travel`| Sitter marketplace, verification badges, aviation clearance, travel passports, emergency cards, pet translation. |
| **SugarDaddy.lgbt** | External | ISOLATE & BRIDGE | Separate 501(c)(3) entity, air-gapped database, explicit opt-in referral bridge. |

---

# 6. Repository Topology & Tech Stack

## 6.1 Repository Structure

```text
robs46859-eng/virtuapet-platform
├── apps/
│   ├── consumer-web/          # Next.js 15 PWA, Sahara Light & Dark Orbital Mode
│   ├── vet-web/               # Next.js 15 Clinic Command Surface
│   ├── admin-web/             # Internal governance console
│   └── developer-docs/        # Static Astro/Starlight API docs
├── services/
│   ├── edge-bff/              # Node.js/Fastify BFF aggregator
│   ├── pet-core/              # Canonical pet graph & household management
│   ├── wellness/              # Stelar biometric time-series & anomaly analysis
│   ├── pet-identity/          # Pawprint ID, pgvector biometric matching, ZK-proofs
│   ├── mobility/              # Go domain, RTK GNSS tracking, kinetic corridor logs
│   ├── care-marketplace/      # Day care/overnight discovery, capacity, booking, custody
│   ├── vet-marketplace/       # Clinic vendors, catalog, quotes, POs, receiving, recalls
│   ├── marketplace-trust/     # Provider credentials, insurance, screening, suspensions
│   ├── marketplace-ledger/    # Fees, connected accounts, payouts, refunds, disputes
│   ├── travel/                # Aviation manifests, FAA/IATA/USDA compliance
│   ├── communications/        # Azure Communication Services, SMS/email workers
│   ├── vet-operations/        # Clinic tenant overlay, patient flow, EMR sync
│   ├── vet-scheduling/        # Multi-resource booking engine, Redis lock holds
│   ├── vet-inventory/         # Event-sourced immutable inventory ledger
│   ├── vet-planning/          # Pricing simulator, overhead allocation models
│   ├── vet-compliance/        # Rule packs, credential registry, evidence vault
│   ├── facility-twin/         # 2D/3D spatial geometry, IoT beacon nodes
│   ├── clinical-twin/         # DICOM anatomy + PIMS/labs/longitudinal context + plans
│   ├── psi/                   # Patient-specific instrument design and release controls
│   ├── pain-observation/      # Feline Grimace Scale workflow and validation registry
│   ├── regulatory-link/       # Address-to-jurisdiction rules, sources, dates, conflicts
│   ├── integrations/          # PIMS, PACS/DICOMweb, government, and travel adapters
│   └── asset-coordinator/     # 3D pipeline coordinator, Blender worker bridge
├── packages/
│   ├── contracts/             # OpenAPI 3.1 & JSON Schemas
│   ├── auth/                  # IdentityAdapter, Ed25519 & Clerk wrappers
│   ├── permissions/           # RBAC & ZK Permission Grant engine
│   ├── events/                # Service Bus typed event envelopes & Outbox
│   ├── design-tokens/         # Sahara design tokens (Tailwind plugin & CSS vars)
│   └── ui/                    # Sahara React component library (GlassCard, HUD, etc.)
├── infra/
│   ├── bicep/                 # Azure Infrastructure as Code
│   └── hostinger/             # Web deploy configurations
```

## 6.2 Languages and Frameworks

- **Frontend:** TypeScript, React 19, Next.js 15, Tailwind CSS with Sahara custom plugin, Three.js (3D twin viewer).
- **Domain Services:** Node.js 22 LTS, Fastify, TypeScript, Prisma/Kysely.
- **AI Gateway & Billing:** Python 3.12, FastAPI, Pydantic v2 (Layer8).
- **Spatial AR Engine:** C#, Unity 6 LTS (GibiWorld native mobile/spatial).
- **3D Asset Workers:** Python 3.11, Blender headless 4.x CLI, Open3D.
- **Data Stores:** PostgreSQL 16 Flexible Server (with `pgvector`, `postgis`, `pg_trgm`), Azure Managed Redis 7.2, Azure Blob Storage.

---

# 7. Deployment & Infrastructure Architecture

```text
                                  +------------------------+
                                  | Hostinger DNS Edge     |
                                  | *.virtuapet.com       |
                                  +-----------+------------+
                                              |
                   +--------------------------+--------------------------+
                   |                                                     |
                   v                                                     v
      +-------------------------+                           +-------------------------+
      | Hostinger Edge Hosting  |                           | Azure Front Door        |
      | Next.js Static / PWA    |                           | Premium WAF + CDN       |
      | - consumer-web          |                           +------------+------------+
      | - vet-web               |                                        |
      +------------+------------+                                        v
                   |                                        +-------------------------+
                   | HTTPS REST / WS                        | Azure API Management    |
                   +--------------------------------------->| (Global Gateway Policy) |
                                                            +------------+------------+
                                                                         |
            +--------------------+---------------------+-----------------+---------------------+
            |                    |                     |                 |                     |
            v                    v                     v                 v                     v
     +--------------+     +---------------+     +---------------+ +---------------+     +---------------+
     | ca-edge-bff  |     | ca-pet-core   |     | ca-vet-ops    | | ca-layer8     |     | ca-integrat'n |
     | Fastify BFF  |     | Domain API    |     | Domain API    | | FastAPI Gov AI|     | PIMS Engine   |
     +-------+------+     +-------+-------+     +-------+-------+ +-------+-------+     +-------+-------+
             |                    |                     |                 |                     |
             +--------------------+----------+----------+-----------------+---------------------+
                                             |
                     +-----------------------+-----------------------+
                     |                       |                       |
                     v                       v                       v
         +-----------------------+ +--------------------+ +-----------------------+
         | Azure Database for    | | Azure Managed      | | Azure Service Bus     |
         | PostgreSQL Flexible   | | Redis 7.2          | | Topics & Queues       |
         | (pgvector + PostGIS)  | | (Locks & Ephemeral)| | (Outbox Domain Bus)   |
         +-----------+-----------+ +--------------------+ +-----------+-----------+
                     |                                                |
                     +-----------------------+------------------------+
                                             |
                             +---------------+---------------+
                             |                               |
                             v                               v
                 +-----------------------+       +-----------------------+
                 | Azure Blob Storage    |       | Container Apps Jobs   |
                 | (Private & Quarantine)|       | (3D Mesh/Blender/OCR) |
                 +-----------------------+       +-----------------------+
```

---

# 8. Sahara Consumer Dashboard Architecture

The consumer dashboard in `stitch_virtuapet_care_platform` represents a revolutionary leap from conventional pet apps: it treats the companion animal as a **sovereign biometric being** with a real-time digital twin, cryptographic health passport, and live orbital telemetry.

```text
+----------------------------------------------------------------------------------------------------+
| 1. GLOBAL SLIM OPERATING SYSTEM BAR (Header)                                                      |
| [Emblem + VirtuaPet] [Kona's Twin Active • BLE 5.4 • 94%]  [DASHBOARD | HEALTH & ID | ...] [Beacon]|
+----------------------------------------------------------------------------------------------------+
| 2. ORBITAL STAGE CANVAS (Central 3D Volumetric Photogrammetry + 4 Docked Feature Cards)            |
|                                                                                                    |
|  +---------------------------+   +-------------------------------+   +---------------------------+ |
|  | DOCKED CARD 1:            |   | FOCAL ORBITAL STAGE           |   | DOCKED CARD 3:            | |
|  | Health & ID Passport      |   | - Outer orbit: Active Burn    |   | Digital Profile & Traces  | |
|  | - Microchip #985141-89B   |   |   (1,420 kcal/day)            |   | - 4.8M Poly LiDAR Mesh    | |
|  | - Rabies Titre: 3.8 IU/mL |   | - Inner orbit: Resting HR     |   | - Sprint Corridor:        | |
|  | - ZK-Vault: Zero-Leak     |   |   (74 BPM athletic sinus)     |   |   48.6 km/h Peak Velocity | |
|  | - Dr. K. Sato Signed      |   | - Radar Sweep: Active Sensor  |   | - Genomic Lineage: 100%   | |
|  +---------------------------+   | - Central 3D Volumetric Mesh  |   +---------------------------+ |
|                                  |   KONA d'or • 3.5 YRS         |                                 |
|  +---------------------------+   | - Safe Radius: 45m Presidio   |   +---------------------------+ |
|  | DOCKED CARD 2:            |   | - Nom. Temp: 101.2°F          |   | DOCKED CARD 4:            | |
|  | Care & Travel Command     |   | - GNSS RTK Precision: ±0.4m   |   | Biometric Commerce        | |
|  | - FAA & USDA Endorsed     |   +-------------------------------+   | - Wild Salmon Formula     | |
|  | - Handler: Jordan Lee     |                                       |   Omegas 3+6 Blend ($64)  | |
|  | - Cabin Clearance: Auto   |                                       | - Titanium Clasp Battery: | |
|  | - 1-Tap Handler Dispatch  |                                       |   Nominal / Auto-Reorder  | |
|  +---------------------------+                                       +---------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
| 3. FLOATING TELEMETRY CHROME DOCK                                                                 |
| [ (radar) Live Telemetry | (route) Trail Map | (notes) Clinical Logs | (ar) 3D Studio ] [Vet Call] |
+----------------------------------------------------------------------------------------------------+
```

## 8.1 Orbital Stage & Real-Time Sensors

- **Volumetric Likeness Canvas:** Interactive WebGL/Three.js rendering of the companion animal's 3D photogrammetric mesh, dynamically lit with golden hour desert radiance.
- **Concentric Kinetic Orbits:**
  - *Outer Orbit (Slow CW 38s):* Metabolic energy dissipation badge (`1,420 kcal / day Active Burn`).
  - *Inner Orbit (Reverse CCW 44s):* Cardiac rhythm telemetry badge (`74 BPM Resting Athletic Sinus`, pulsating heart icon).
  - *Radar Sweep (5s sweep):* Real-time BLE 5.4 mesh proximity and RTK GNSS anchor accuracy (`±0.4m precision`).
- **Telemetry HUD Overlays:**
  - Internal Body Temperature: `101.2°F` (Calibrated nominal baseline: 101.0°F–102.5°F).
  - Safe Radius Geofence Anchor: `45m Presidio Home Anchor`.

## 8.2 The Four Docked Feature Modules

1. **Health & ID Passport:** Transponder FDX-B `#985141-89B`, ISO 11784/11785 compliance, Rabies Antibody FAVN Titre `3.8 IU/mL` (exceeds EU/UK requirements), zero-leak ZK-vault, cryptographically signed by Dr. K. Sato, DVM.
2. **Care & Travel Command:** FAA 8400-3 and USDA APHIS certifications, verified handler Jordan Lee (K9 Wilderness Medic Grade I, ETA 14 min), auto-cleared pressurized cabin transit, 1-tap handler dispatch.
3. **Digital Profile & Traces:** 4.8M pointcloud photogrammetric mesh, 100% Saluki genomic trace, high-velocity kinetic sprint corridor record (`48.6 km/h`), sub-millimeter gait symmetry (`99.4%`).
4. **Biometric Commerce & Rations:** Metabolically calibrated rations (Wild Salmon + Cold-Pressed Camelina Oil), titanium clasp v4.8 battery nominal status, predictive 2-day delivery replenishment.

## 8.3 Health & ID Passport Page Specification

Located at `/health-and-id`, rendered in Sahara Warm Linen:
- **Biometric Smart Pet Card:** Visual skeuomorphic digital pass featuring companion photo, FDX-B 15-digit code (`985 141 002 948 210`), ZK cryptographic digest (`0x7f4e8b39a...`), gold microchip wafer graphic, and NFC scan trigger.
- **Clinical Readiness Vitals Bento:** Real-time stream of resting heart rate (with live SVG ECG sparkline), internal temperature, hydration coefficient (`92.4%`), respiratory rate (`22 Br/min`), and recovery index (`94/100`).
- **Immunization & Titer Cryptographic Ledger:** Complete tabular audit of Rabies FAVN, Core DHPP, Leptospirosis 4-Way, Bordetella, and Lyme C6 ELISA with administering clinic signatures and validity horizon.
- **Longitudinal Clinical History:** Milestone timeline detailing annual bio-audits, ultrasound scans, dental tartar index (`0.2mm`), and orthopedic force plate gait symmetry.

## 8.4 Care & Travel Command Page Specification

Located at `/care-and-travel`, rendered in Sahara Warm Linen:
- **Aviation Manifest Header:** Transit clearance ribbon for private (JSX) and commercial (Delta PetFirst, United Cabin) travel.
- **Active Escort Protocol:** Live handler GPS map track across Presidio coastal routes, audio link button, geofence trace, and smart clasp release.
- **Pre-Transit Regimen:** Timed protocol covering aerobic sprints, joint hydrotherapy chamber sessions, acoustic cabin noise desensitization, and pre-flight electrolyte dispensing.
- **International Transit Dossier:** Hawaii DAR-5 (Direct Airport Release 5-day or less), DEFRA / EU Annex IV passport verification, and tapeworm administration windows.
- **24/7 Global Emergency Enclave:** 1-tap ER dispatch to trauma units (e.g. Aloha Veterinary Center, 4.8 miles from arrival) and direct telehealth vet connection.

## 8.5 Digital Profile & Traces Page Specification

Located at `/digital-profile-and-traces`:
- **Interactive 3D Likeness Viewport:** Volumetric, Wireframe, and Gait IK rigging view modes with 360° rotation dial and export options (USDZ / GLTF / PDF Diagnostic).
- **Synchronized Hardware Rig:** Real-time sensor statuses for Titanium Collar v4.8, Trail Harness Pro (6-axis IMU), and Night Pulse Beacon (680nm optical sync).
- **Behavioral & Movement Traces Bento:** Kinetic ridge trace velocity profile (SVG vector sparkline), metabolic energy dissipation progress ring, environmental acoustic/UV index monitor, and P2P BLE peer canine encounter log.

---

# 9. VirtuaPet VetOS Clinic Dashboard UI Interface

The **VirtuaPet VetOS Clinic Command Interface** (`vet.virtuapet.com`) is the operational heart of the veterinary practice. Designed using the Sahara Warm Minimalism and Telemetry Matrix principles, it replaces clunky, gray legacy PIMS screens with an editorial, high-density, low-fatigue command environment.

```text
+------------------------------------------------------------------------------------------------------------------------+
| 1. GLOBAL SLIM CLINIC HEADER                                                                                           |
| [VetOS Logo] Northside Veterinary Center [Location: Main Surgical Hub v] [PIMS: IDEXX Synced] [Search Client/Pet/Chip] |
+-----------------------+------------------------------------------------------------------------------------------------+
| 2. NAVIGATION RAIL    | 3. TODAY CLINIC COMMAND CENTER (Active Operating Floor)                                        |
| (64px / 240px wide)   |                                                                                                |
|                       |  [ KPI SUMMARY HUD: 42 Scheduled | 4 In Triage | 2 Emergencies | 94% Room Util | 98.2% Retention ]   |
| [=] Command Center    |  --------------------------------------------------------------------------------------------  |
| [*] Schedule Matrix   |  +--------------------------------------------+  +-------------------------------------------+ |
| [o] Patients & Dossier|  | REAL-TIME PATIENT FLOW & TRIAGE QUEUE      |  | MULTI-RESOURCE OPERATING GRAPH            | |
| [+] Clinical Ops      |  | - 08:30 Room 1: Milo (Golden) - Annual     |  | - OR 1: Dr. Vance / Ortho Stifle Surg     | |
| [~] Automations       |  |   [ZK-Passport Verified] [Titer: OK]       |  | - Exam 2: Dr. Sato / Cardiac Ultrasound   | |
| [#] Inventory Ledger  |  | - 09:00 Room 3: Kona (Saluki) - Pre-Flight |  | - Dental Suite: LVT Sarah / Prophy Clean  | |
| [@] AI Communications |  |   [Air Clearance Sync] [Vitals Streaming]  |  | - Recovery Bay: 4 of 6 kennels occupied   | |
| [$] Financial Planning|  +--------------------------------------------+  +-------------------------------------------+ |
| [!] Compliance Vault  |                                                                                                |
| [&] Digital Twin Map  |  +--------------------------------------------+  +-------------------------------------------+ |
| [?] Settings          |  | AI VOICE RECEPTIONIST & TRIAGE MONITOR     |  | INVENTORY & SMART CABINET TELEMETRY       | |
|                       |  | - Incoming Call #4819: Emergency Choking   |  | - Propofol 20ml: Low Stock (2 vials left) | |
|                       |  |   Sentiment: High Urgency -> Escalate DVM  |  | - Rabies FAVN Serum: Reorder Triggered    | |
|                       |  | - Call #4818: Routine Reschedule -> Handled|  | - Controlled Substance Safe: Double-Signed| |
|                       |  +--------------------------------------------+  +-------------------------------------------+ |
+-----------------------+------------------------------------------------------------------------------------------------+
```

## 9.1 Clinic Header & Global Operating Controls

1. **Clinic Switcher & Identity Bar:** Displays clinic name, multi-location selector dropdown (e.g. `Presidio West Surgical`, `Downtown Urgent Care`), and tenant status indicator (`Tenant: #VET-9042`).
2. **PIMS Synchronization Heartbeat:** Live bidirectional synchronization badge indicating handshake status with IDEXX Cornerstone / Neo / ezyVet (`Last Sync: 14s ago • 0 Conflict`).
3. **Omni-Search Bar:** Universal search input supporting client name, pet name, phone number, 15-digit FDX-B microchip number, or sovereign `DID:PET:<id>`. Pressing `/` focuses search from anywhere.
4. **Emergency Intake Action:** Terracotta-crimson button (`+ Emergency Walk-In`) triggering instant triage bay reservation and veterinary alert broadcast.

## 9.2 Today Command Center (Operating HUD)

The Today Command Center aggregates five mission-critical widgets:

### 1. Clinic Velocity & Performance Ribbon
- **Appointments Today:** `42 Scheduled` (`18 Completed`, `6 In Progress`, `16 Upcoming`, `2 Cancelled/Rescheduled`).
- **Active Triage:** `4 In Waiting Room` (`Avg Wait: 6.2 min`).
- **Emergency Priority:** `1 Code Amber` (Acute respiratory distress, En Route via Consumer App Emergency Beacon, ETA 8 min).
- **Resource Utilization:** `92% Doctor Capacity`, `88% Surgical Suite Utilization`.
- **Revenue Run-Rate:** `$14,820 Today` (versus $12,500 target).

### 2. Live Patient Flow & Triage Queue (Bento Card)
A rich list of current and imminent clinic visits:
- **Card Header:** Filterable by status (`All`, `In Waiting`, `In Exam`, `In Surgery`, `Discharged`).
- **Patient Item Row:**
  - Companion Photo & Breed Avatar;
  - Pet Name & Age (`Kona • 3.5 Yrs • Saluki Mix`);
  - Owner Info & Verified Phone (`Kaelen Vance • (415) 555-0192`);
  - Appointment Reason & Service (`Pre-Aviation USDA International Transit Exam`);
  - Assigned Provider & Support Staff (`Dr. K. Sato, DVM • Tech: Marcus LVT`);
  - Assigned Physical Room (`Exam Room 3 • 25 min allocated`);
  - **Sovereign Health Card Chip:** Clickable tag displaying `ZK-Passport: Verified`, `Rabies Titre: 3.8 IU/mL Valid`, `Allergy Alert: Zero Grain/Poultry`;
  - Quick Actions: `Check In`, `Open Clinical Chart`, `Initiate Telemetry Feed`, `Send Payment Link`.

### 3. Patient Telemetry & Sovereign Biometrics Dossier Modal
When a patient is selected, the VetOS Dossier presents real-time data received via the consumer's Smart Collar and EMR sync:
- **Biometric Stream:** Live resting heart rate, respiratory rate, and temperature received from the patient's wearable prior to clinic arrival.
- **Vaccination Merkle Ledger:** Instantly view verified titers with zero-knowledge proof verification stamps.
- **Diagnostic Timeline:** Historical ultrasound, blood chemistry, and surgical notes formatted in clean chronological hierarchy.

### 4. Multi-Resource Operating Matrix (Schedule Grid)
The VetOS schedule view prevents double-booking across three simultaneous constraints:
```text
           [ Exam Room 1 ]    [ Exam Room 2 ]    [ Surgical Suite ]    [ Dental Suite ]
08:00 AM   [ Dr. Vance   ]    [ Dr. Sato    ]    [ Dr. Vance      ]    [ Sarah, LVT   ]
           [ Milo - Annual]   [ Bella - Ear ]    [ Buster - Ortho ]    [ Rocky - Clean]
08:30 AM   [-------------]    [ Luna - Vac  ]    [----------------]    [--------------]
09:00 AM   [ Kona - Travel]   [ Max - Skin  ]    [ Recovery Mon.  ]    [ Daisy - Pol. ]
```
- **Triple-Binding Guarantee:** A booking is only valid if Provider + Room + Specialized Equipment (e.g. Ultrasound cart) are concurrently unreserved.
- **Color Coding:** Sahara warm primary (`#c2652a`) for standard consults, warm amber (`#e5a953`) for diagnostics/procedures, dusty rose (`#8c3c3c`) for surgeries/emergencies, and muted olive for drop-off care.

### 5. AI Voice Receptionist & Omnichannel Communication Console
Located on the lower dashboard bento:
- **Active Call HUD:** Real-time telephony widget connected via Azure Communication Services / Layer8.
- **Live Call Stream:** Shows ongoing call `#4819` with caller sentiment analysis (`Urgent - Post-op Coughing`).
- **Transcription Stream:** Real-time speech-to-text transcription running through Layer8 PII redaction.
- **Extracted Action Items:** Suggested 1-click actions generated by Layer8 (e.g., `Schedule Emergency Slot 11:15 AM`, `Send Post-Op Care Guide to Client`, `Notify Dr. Vance`).
- **Human Handoff Button:** 1-tap takeover by front-desk receptionist with zero audio stutter.

### 6. Clinical Inventory Ledger & Smart Cabinet HUD
- **Real-Time On-Hand:** Visual indicator of pharmaceutical and surgical stock levels.
- **Controlled Substance Watchdog:** Dual-PIN authentication log for Schedule II/III substances (Ketamine, Buprenorphine, Propofol).
- **Automated Reorder Thresholds:** Predictive replenishment cards linked directly to Henry Schein / MWI Animal Health catalogs.

### 7. Compliance Evidence Vault & Jurisdictional Watchdog
- **Facility Accreditation:** AAHA / State Board License renewal countdowns (`State Pharmacy License: 42 Days Remaining`).
- **X-Ray / Radiation Dosimeter:** Quarterly badge readout upload status.
- **Waste & Biohazard Disposal:** Certified manifests and destruction logs.

### 8. Digital Twin Clinic Spatial Map (Command Tier)
- **2D/3D Floor Plan Viewport:** Real-time architectural layout of the clinic facility.
- **Room Occupancy Nodes:** Green (Vacant/Clean), Amber (Occupied), Red (Sanitization In Progress), Blue (Surgical Sterile).
- **Mobile Equipment Tracking:** Real-time location tags for portable X-ray units, ultrasound carts, and infusion pumps.

---

# 10. Identity, Sovereign Enclave, and Authentication

## 10.1 Dual Enclave Authentication Architecture

As established in `virtuapet_sovereign_access_authentication/code.html`, VirtuaPet enforces a sovereign, air-gapped authentication architecture:

```text
                               +---------------------------------------+
                               | Consumer / Staff Authentication Gate  |
                               +-------------------+-------------------+
                                                   |
                   +-------------------------------+-------------------------------+
                   v                                                               v
      +-------------------------+                                     +-------------------------+
      | Mode A: Sign In         |                                     | Mode B: Establish Vault |
      | - Verified Email        |                                     | - Companion Legal Name  |
      | - Ed25519 Passphrase    |                                     | - Enclave Region        |
      | - Cryptographic Strength|                                     | - Vet Referral Key      |
      +------------+------------+                                     +------------+------------+
                   |                                                               |
                   +-------------------------------+-------------------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               | Hardware Authenticator / WebAuthn     |
                               | - Apple Touch ID / Face ID            |
                               | - YubiKey FIDO2 Security Key          |
                               | - Smart Collar NFC / Transponder Tap  |
                               +-------------------+-------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               | IdentityAdapter Token Minting         |
                               | - Short-lived Platform JWT (15 min)   |
                               | - Tenant & Household Context Claims   |
                               +---------------------------------------+
```

## 10.2 Cryptographic Tokens and Claims

The platform issues signed JWTs with explicit context claims:

```json
{
  "sub": "usr_9042a81b",
  "iss": "https://api.virtuapet.com/v1/auth",
  "aud": "virtuapet-platform",
  "exp": 1789315200,
  "iat": 1789314300,
  "householdId": "hh_38f2910c",
  "activePetId": "pet_kona_771b",
  "tenantId": "clinic_presidio_west",
  "roles": ["clinic_practitioner", "pet_owner"],
  "entitlements": ["vetos_command", "sovereign_telemetry"]
}
```

---

# 11. Canonical Pet Graph & Biometric Identity

## 11.1 Pet Database Entity

```sql
create table pet (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references household(id),
    name text not null,
    species text not null default 'canine',
    breed text,
    genetic_trace_summary text,
    birth_date date,
    approximate_birth_date boolean not null default false,
    sex text check (sex in ('male_intact', 'male_neutered', 'female_intact', 'female_spayed', 'unknown')),
    weight_kg numeric(6,2),
    withers_height_cm numeric(5,1),
    chest_girth_cm numeric(5,1),
    spine_arc_cm numeric(5,1),
    fdx_b_microchip_id text unique,
    did_identifier text unique not null,
    zk_digest text,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_pet_household on pet(household_id);
create index idx_pet_microchip on pet(fdx_b_microchip_id);
create index idx_pet_did on pet(did_identifier);
```

## 11.2 Biometric Vector Embeddings (Pawprint ID)

Using PostgreSQL with `pgvector`:

```sql
create table pet_biometric_profile (
    id uuid primary key default gen_random_uuid(),
    pet_id uuid not null references pet(id) on delete cascade,
    modality text not null check (modality in ('pawprint', 'retinal', 'morphometric_silhouette', 'facial')),
    embedding vector(512) not null,
    quality_score numeric(4,3) not null,
    algorithm_version text not null,
    created_at timestamptz not null default now()
);

create index idx_pet_biometric_embedding on pet_biometric_profile
using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

---

# 12. Clinic Operating Graph & Multi-Tenancy

## 12.1 Clinic Tenant Structure

```sql
create table clinic_tenant (
    id uuid primary key default gen_random_uuid(),
    legal_name text not null,
    dba_name text not null,
    tier text not null check (tier in ('core', 'growth', 'intelligence', 'command')),
    stripe_customer_id text unique,
    stripe_subscription_id text,
    pims_type text check (pims_type in ('idexx_cornerstone', 'idexx_neo', 'ezyvet', 'covetrus_pulse', 'hippo', 'none')),
    pims_sync_status text default 'inactive',
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table clinic_location (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references clinic_tenant(id) on delete cascade,
    name text not null,
    timezone text not null default 'America/Denver',
    address_line1 text not null,
    city text not null,
    state_province text not null,
    postal_code text not null,
    coordinates geography(point, 4326),
    emergency_capable boolean default false,
    phone_number text not null,
    created_at timestamptz not null default now()
);
```

## 12.2 Multi-Tenant Row Level Security (RLS)

Every VetOS table enforces strict PostgreSQL RLS policies:

```sql
alter table vet_appointment enable row level security;

create policy vet_appointment_tenant_isolation on vet_appointment
using (tenant_id = current_setting('app.tenant_id', true)::uuid)
with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

# 13. Event Architecture & Outbox Pattern

To prevent distributed transactional drift, all domain state changes and event notifications are committed in a single atomic database transaction via the **Outbox Pattern**.

```text
                     +---------------------------------------+
                     | Domain Transaction (e.g. Appointment) |
                     +-------------------+-------------------+
                                         |
                                         v
                     +---------------------------------------+
                     | BEGIN TRANSACTION                     |
                     |   1. UPDATE vet_appointment           |
                     |   2. INSERT INTO outbox_event         |
                     | COMMIT TRANSACTION                    |
                     +-------------------+-------------------+
                                         |
                                         v
                     +---------------------------------------+
                     | Asynchronous Outbox Worker Service    |
                     | (Polls unread outbox_event table rows)|
                     +-------------------+-------------------+
                                         |
                                         v
                     +---------------------------------------+
                     | Azure Service Bus Topic:              |
                     | "virtuapet-domain-events"            |
                     +-------------------+-------------------+
                                         |
             +---------------------------+---------------------------+
             |                           |                           |
             v                           v                           v
+-------------------------+ +-------------------------+ +-------------------------+
| Consumer Notification   | | Inventory Forecast      | | Vet Retention Engine    |
| Worker (Push / SMS)     | | Deduction Worker        | | Automated Recalls       |
+-------------------------+ +-------------------------+ +-------------------------+
```

## 13.1 Canonical Event Envelope

```json
{
  "eventId": "01J7N38AB987C6D5E4F3210001",
  "eventType": "appointment.completed",
  "eventVersion": 1,
  "occurredAt": "2026-09-13T18:30:00Z",
  "producer": "vet-operations",
  "tenantId": "c9284f10-1842-4f2a-8991-8899aabbccdd",
  "householdId": "38f2910c-9912-4aa1-bb22-334455667788",
  "petId": "771b8822-0011-4433-8899-aabbccddeeff",
  "correlationId": "01J7N300000000000000000000",
  "data": {
    "appointmentId": "apt_99214",
    "providerId": "stf_dr_sato",
    "serviceType": "international_travel_exam",
    "billedTotalCents": 18500,
    "prescriptionsIssued": ["med_electrolyte_pack_v1"],
    "titerVerified": true
  }
}
```

---

# 14. Layer8 Governed AI & Billing Gateway

Layer8 acts as the impenetrable firewall between VirtuaPet services and external LLM providers (Anthropic, OpenAI, Azure OpenAI):

```text
Client / Front Desk / Voice AI
    |
    v
Azure API Management (/v1/ai/*)
    |
    v
Layer8 FastAPI Container App (ca-layer8-prod)
    |
    +---> Policy Pack Hook (PII scrub, role-safety validator)
    |
    +---> Tool Gateway (Approved schema validator)
    |         |
    |         +---> Deterministic VirtuaPet Command (e.g. lockSlot, fetchHours)
    |
    +---> Provider Routing & Failover (Claude 3.5 Sonnet -> GPT-4o -> Azure OpenAI)
    |
    +---> Audit Ledger & Metering (Token counting -> Azure Managed Redis & Blob)
```

## 14.1 Allowed vs Prohibited Tool Execution

| Tool Category | Permitted Tools | Prohibited Autonomous Tools |
|---|---|---|
| **Front-Desk AI Receptionist** | `get_clinic_hours`, `find_open_appointment_slots`, `create_booking_hold`, `request_invoice_link`, `handoff_to_human` | `write_medical_record`, `prescribe_drug`, `override_clinical_triage`, `cancel_confirmed_surgery` |
| **Client Retention Copilot** | `draft_recall_email`, `calculate_titer_due_date`, `suggest_rebooking_time` | `send_unreviewed_medical_critique`, `alter_client_billing_rate` |
| **Inventory Copilot** | `analyze_shrink_variance`, `generate_draft_purchase_order` | `execute_unauthorized_payment`, `delete_inventory_audit_log` |

---

# 15. Multi-Resource Scheduling Engine

Veterinary clinic scheduling is fundamentally more complex than human outpatient visits because an appointment typically requires:
1. One Licensed Veterinarian (DVM);
2. One or more Veterinary Technicians (LVT);
3. An Exam Room, Surgical Suite, or Dental Bench;
4. Specialized equipment (e.g., Dental Radiography, Digital Ultrasound, Anesthesia Rig).

## 15.1 Availability Constraint Formula

$$\text{Slot Available} \iff \text{Hours}(\text{Clinic}) \land \text{Avail}(\text{DVM}) \land \text{Avail}(\text{Techs}) \land \text{Avail}(\text{Room}) \land \text{Avail}(\text{Equipment}) \land \neg \text{Blocked}$$

## 15.2 Double-Booking Prevention via Two-Phase Locks

1. **Phase 1: Ephemeral Redis Hold (120 seconds TTL)**
   ```text
   SET slot_hold:{tenantId}:{locationId}:{roomId}:{startsAt} {holdToken} NX EX 120
   ```
2. **Phase 2: PostgreSQL Serialized Commit**
   Validates Postgres range exclusion constraints `tstzrange(starts_at, ends_at, '[)')` across provider, room, and equipment tables.

---

# 16. Immutable Clinical Inventory Ledger

VetOS replaces editable stock count cells with an event-sourced, append-only double-entry ledger.

## 16.1 Ledger Event Types

- `RECEIPT`: Inward shipment verified from purchase order.
- `CONSUMPTION`: Consumed during medical procedure or OTC sale.
- `ADJUSTMENT`: Physical cycle count correction.
- `TRANSFER`: Moved between clinic locations or mobile units.
- `EXPIRY`: Removed due to manufacturer lot expiration.
- `WASTE`: Accidental breakage or discard.

$$\text{Current On-Hand} = \sum_{\text{events}} \text{signed\_quantity}$$

## 16.2 Controlled Substance Protocol

Any transaction involving DEA Schedule II–V pharmaceuticals requires:
- Dual-PIN authentication (attending veterinarian + licensed technician);
- Physical vial container barcode scan;
- Remaining volume balance calculation;
- Discrepancy flagging exceeding 1.5% volumetric tolerance.

---

# 17. Compliance Evidence Vault & Jurisdictional Watchdog

The Command tier includes an automated regulatory intelligence engine:

- **Rule Packs:** Jurisdiction-specific codifications of veterinary board regulations, radiation safety rules, hazardous waste disposal guidelines, and OSHA standards.
- **Evidence Vault:** Immutable Azure Blob storage container with SHA-256 verification hashes for facility permits, DEA registrations, autoclave spore test logs, and staff licenses.
- **Inspection Readiness Scorecard:** Real-time audit readiness metric (0–100%) alerting the practice manager to upcoming expirations 90, 60, and 30 days in advance.

---

# 18. Digital Twin Clinic Spatial Facility Mapping

The Digital Twin Clinic translates physical practice architecture into an actionable operational plane:

```text
+-----------------------------------------------------------------------------------------+
| DIGITAL TWIN CLINIC FACILITY VIEWER (2D Floor Plan / 3D glTF Spatial Nodes)            |
|                                                                                         |
|  [ WAITING LOUNGE ]     [ RECEPTION ]     [ TRIAGE BAY 1 ]     [ TRIAGE BAY 2 ]         |
|  (4 Occupants)          (Staff: 2)        (Occupied: Kona)     (Vacant • Clean)         |
|                                                                                         |
|  ==================== CENTRAL CIRCULATION CORRIDOR ===================================  |
|                                                                                         |
|  [ SURGERY SUITE 1 ]    [ SURGERY SUITE 2 ]  [ PHARMACY / VAULT ] [ RADIOLOGY SUITE ]   |
|  (Status: IN SURGERY)   (Status: STERILE)    (Safe: SECURED)      (Sensor: Nominal)     |
|  [Mobile US Cart #2]                         [Smart Cabinet A]    [Lead Aprons: Valid]  |
+-----------------------------------------------------------------------------------------+
```

- **Spatial Coordinate Integration:** Stores architectural vector polygons using PostGIS geometries.
- **Equipment Telemetry:** Real-time location beacons tracking expensive shared clinic assets.
- **Work Orders:** 1-click facility maintenance requests anchored to specific room or equipment nodes.

---

# 19. Security, Privacy, and Threat Models

## 19.1 Data Classification

| Classification | Examples | Storage Standard |
|---|---|---|
| **Public** | Clinic addresses, marketing copy, published articles | Hostinger Edge / Azure CDN |
| **Internal** | Anonymized system metrics, software logs | Log Analytics, private subnets |
| **Confidential** | Appointment schedules, pet profile metadata | Azure Postgres Flexible with TLS |
| **Restricted** | Biometric vectors, microchip ZK-digests, DEA logs, financial tokens, call recordings | Encrypted at rest (AES-256), Key Vault keys, strict RLS, ZK-proof generation |

## 19.2 Zero-Knowledge Proof (ZKP) Architecture

When a pet owner checks into a boarding facility, daycare, or airline, they must prove immunity without exposing complete clinical history. The VirtuaPet ZK engine generates cryptographic proofs:
- "Kona possesses active Rabies titer $\ge 0.5\text{ IU/mL}$ valid through November 2026" $\implies \text{True}$.
- The recipient verifies the Merkle proof against the veterinary clinic's registered public key without viewing internal medical notes or lab records.

---

# 20. Purpose-Built Marketplaces

VirtuaPet operates two distinct marketplaces. Neither marketplace reuses the retail store, its catalog, its orders, its fulfillment assumptions, or Shopify. Shared platform primitives are limited to verified identity, tenant membership, consent, notifications, Stripe-hosted payment collection, the marketplace ledger framework, audit, and event delivery.

## 20.1 Vet Procurement Marketplace

The VetOS procurement marketplace serves verified veterinary organizations and their authorized purchasing staff. It supports supplies, consumables, diagnostic and surgical equipment, clinic furniture, replacement parts, maintenance contracts, approved implants, and qualified PSI manufacturing services.

```text
Verified Vendor -> Canonical Item <- Vendor Offer / Contract Price
                                      |
Clinic Need -> Purchase Request -> Approval Policy -> Quote or Order
                                      |
                            Shipment -> Receiving
                                      |
                         Inventory / Asset Registry
                                      |
                   Recall / Warranty / Return / Service
```

The canonical model separates a product from an offer. `catalog_item` stores manufacturer, model, identifiers, units, pack size, compatibility, storage, safety documents, lot/serial requirements, and regulated classification. `offer` stores vendor-specific price, contract tier, minimum quantity, availability, fulfillment terms, and effective dates. This prevents one vendor's changing price or availability from corrupting the product identity.

Clinic controls are evaluated server-side: tenant, location, requester role, budget, cost center, formulary, vendor approval, item class, jurisdiction, spending threshold, and required approvers. Layer8 may compare offers or draft a purchase request, but it cannot authorize a payment, regulated substitution, or approval override. Receiving writes immutable inventory events and captures quantity variance, damage, lot, serial, expiration, receiver, and timestamp. Recall matching operates directly on received lots and serialized assets.

Primary states:

```text
DRAFT -> SUBMITTED -> APPROVAL_REQUIRED -> APPROVED
      -> QUOTED -> ORDERED -> PARTIALLY_SHIPPED -> RECEIVED
      -> RECONCILED -> CLOSED

Any valid pre-fulfillment state -> CANCELLED
Received item -> RETURN_REQUESTED -> RETURNED or RETURN_REJECTED
```

## 20.2 Consumer Day-Care and Overnight Marketplace

The care marketplace lets guardians find and book verified day-care and overnight providers. It supports facilities, insured home-boarders where permitted, and approved caregivers. It is separate from clinic scheduling, procurement, travel custody, and retail commerce.

```text
Provider Verification -> Service + Location + Eligibility Policy
                                      |
Guardian Search -> Pet Eligibility -> Capacity Hold -> Payment Authorization
                                      |
                       Provider Acceptance / Instant Book
                                      |
                         Confirmed Booking + Care Grant
                                      |
                    Check-in -> Custody -> Check-out
                                      |
                 Payout / Refund / Dispute / Verified Review
```

Search uses coarse geography until disclosure is needed for a confirmed service. Availability is backed by capacity buckets for species, size, room/run type, staff coverage, and special-care capability. A short-lived hold atomically reserves capacity while required health proof, provider acceptance, and payment authorization complete. Confirmation creates only the minimum time-bound scopes required for the booking. Cancellation, no-show, overbooking, incident, refund, dispute, and payout rules are versioned and preserved with the booking.

The care plan includes feeding, medication instructions, behavior and handling notes, emergency contacts, veterinarian preference, authorized pickup people, communication cadence, and escalation instructions. A signed vaccination-status proof may be shared; the full longitudinal record is not. Custody starts at verified check-in and ends at verified checkout. Safety incidents cannot be hidden or removed by refunding a booking or moderating a review.

## 20.3 Shared Trust, Ledger, and Safety Boundaries

- Vendor and care-provider evidence is versioned, reviewed, expires, and can be suspended or revoked.
- Sponsored placement is labeled and cannot bypass safety, eligibility, availability, jurisdiction, or conflict filters.
- Reviews require a completed booking or procurement transaction and retain immutable moderation evidence.
- Stripe-hosted collection and connected-account capabilities are mediated through Layer8. VirtuaPet stores references and double-entry ledger records, not card data.
- Procurement and care services use separate ledger accounts, payout policies, reconciliation, refund rules, and dispute queues.
- Restricted clinical data is never exposed to a vendor. Care providers receive only fields required by the active booking grant.
- Marketplace search indexes contain public or explicitly publishable provider/catalog projections, never payment secrets or restricted clinical records.

## 20.4 Marketplace Acceptance Thresholds

| Control | Required threshold |
|---|---:|
| Capacity or inventory oversell in concurrency suite | 0 |
| Purchase above policy threshold without all approvals | 0 |
| Booking confirmed without current provider eligibility and required pet proof | 0 |
| Cross-tenant catalog contract, booking, ledger, or payout disclosure | 0 |
| Duplicate charge, payout, refund, receiving, or inventory posting under webhook/event replay | 0 |
| Received regulated lot/serial records traceable to PO and vendor | 100% |
| Active recall matches surfaced to affected clinics | 100% in release fixture suite |
| Care custody check-in and checkout evidence | 100% for completed stays |
| Provider suspension blocking new confirmation | 100% |
| Displayed mandatory fee and cancellation terms captured before confirmation | 100% |

# 21. Clinical Anatomical Twin, Digital Twin, Surgical Planning & PSI

The clinical twin offering is in development for VirtuaPet VetOS Intelligence and Command tiers. It converts approved veterinary DICOM CT/MR studies into a source-linked patient-specific anatomical twin, then enhances the case with PIMS, laboratory, and longitudinal health evidence to form a versioned clinical digital twin for visualization, quantitative surgical planning, virtual rehearsal, and controlled patient-specific instrument design.

The complete implementation and validation contract is defined in `VIRTUAPET_CLINICAL_DIGITAL_TWIN_ARCHITECTURE_v2.md`.

## 21.1 Required Pipeline

```text
PACS / DICOMweb / Secure Upload
  -> quarantine and checksum
  -> DICOM identity, series, spacing, orientation, and laterality validation
  -> modality and anatomy eligibility check
  -> segmentation draft with uncertainty
  -> manual correction and source-slice comparison
  -> anatomical twin: clinical mesh, landmarks, measurements, uncertainty
  -> veterinary structure-by-structure approval
  + PIMS encounters / problems / medications / procedures
  + laboratory and pathology results with units, ranges, status, and provenance
  + longitudinal vitals, outcomes, rehabilitation, and clinician observations
  -> time-stamped clinical digital twin snapshot
  -> desktop planning and protected GibiWorld AR rehearsal
  -> optional PSI design candidate, engineering review, dimensional QA, surgeon release
```

The DICOM study remains the geometric source of truth. Every anatomical twin retains Study, Series, SOP Instance, and Frame of Reference identifiers. PIMS, laboratory, and longitudinal records remain clinical-context sources with source-system identifiers, effective time, author, status, units, reference ranges, corrections, and provenance. Every digital-twin snapshot declares exactly which source versions it used. Derived segmentations, measurements, meshes, plans, PSI candidates, and rehearsal sessions are immutable versions.

## 21.2 Permitted and Prohibited Uses

Permitted release classes are:

- **V1 Visualization:** education, case discussion, and orientation;
- **V2 Quantitative Planning:** validated measurements and plan comparison;
- **V3 Virtual Rehearsal:** validated patient-specific task rehearsal and implant-template exploration.
- **V4 PSI Candidate:** procedure-specific patient-contact instrument design only after V3 validation plus manufacturing, sterilization, dimensional inspection, biocompatibility, labeling, and surgeon-release controls.

Intraoperative navigation, autonomous planning, robotic control, diagnosis, and guaranteed implant or PSI fit are excluded. A case cannot enter rehearsal until a licensed veterinarian approves the required anatomy, source series, laterality, intended use, and known uncertainty. A display mesh is never eligible for PSI manufacture.

## 21.3 Minimum Accuracy and Effectiveness Gates

| Measure | Required threshold |
|---|---:|
| DICOM identifiers, checksum, source count, orientation, and laterality | 100% pass or case blocked |
| Coordinate round-trip error | At most 0.5 mm or one-half source voxel, whichever is larger |
| High-contrast bone Dice score | At least 0.95 |
| High-contrast bone 95th-percentile Hausdorff distance | At most 2.0 mm |
| Major soft-tissue Dice score | At least 0.90 |
| Major soft-tissue mean surface distance | At most 1.5 mm |
| Critical landmark target registration error | Median at most 1.0 mm; 95th percentile at most 2.0 mm |
| Linear measurement error | At most 1.0 mm up to 50 mm; otherwise at most 2% |
| Angular error | At most 2 degrees |
| Validated AR scale error | At most 2% |
| Laterality or patient mismatch | Zero tolerated |
| Veterinary approval before rehearsal | 100% |
| PIMS/lab record mapped to correct patient, source, effective time, units, and status | 100% or excluded from snapshot |
| Corrected/cancelled laboratory result supersession | 100% reflected; stale result never shown as current |
| Digital-twin snapshot reproducibility from declared inputs | 100% |
| PSI clinical-contact surface deviation from released design | Procedure-specific; maximum 0.5 mm unless a stricter validated limit applies |
| PSI critical guide/axis angular deviation | At most 1 degree unless procedure validation requires less |
| PSI dimensional inspection and surgeon release before manufacture/use | 100% |
| PSI derived from approved clinical geometry, never display geometry | 100% |

These are release targets, not current performance claims. Validation is locked to a named species, modality, anatomy, scanner/acquisition range, and intended use. Unsupported cases are rejected or downgraded.

# 22. Feline Grimace Scale Acute Pain Workflow

The Feline Grimace Scale workflow is in development as a structured clinical observation tool. It scores ear position, orbital tightening, muzzle tension, whisker position, and head position from 0 to 2 each, producing a total from 0 to 10.

The first release is manual. Staff observe an awake cat undisturbed for 30 seconds, wait when the cat is eating, grooming, or vocalizing, score each action unit, and record context. A total of 4 or more opens a clinician-review prompt. A score of exactly 4 can start a 10-to-15-minute reassessment timer when the veterinarian is uncertain. The software never orders or administers analgesia.

Any future automated image assist requires a dedicated veterinary model and external validation. Minimum targets include sensitivity at least 0.95 at the 4-of-10 threshold, specificity at least 0.85, weighted kappa at least 0.80, mean absolute error at most 0.75 points, threshold disagreement below 5%, and abstention when an image or action unit is not scorable. General-purpose chatbots are prohibited from making the clinical score.

# 23. Smart Global Vet Link

Smart Global Vet Link is an in-development regulatory workflow for clinics and pet owners. It uses an origin address, destination address, route, dates, species, animal count, ownership purpose, transport method, and existing records to build a dated checklist.

The service resolves addresses to legal jurisdictions, then evaluates versioned rules from government and carrier sources. It can identify possible microchip, vaccination, test, treatment, permit, certificate, endorsement, entry-point, and timing requirements.

Every mandatory rule must show its source, retrieval time, effective date when known, status, and reviewer. Conflicts, missing official guidance, border ambiguity, stale sources, and unsupported species block a green clearance. High-risk itineraries require human review before a clinic signs any certificate.

Release targets include at least 99.5% supported address-to-jurisdiction accuracy, at least 99% mandatory-rule recall against expert-authored itineraries, 100% date-calculation accuracy in the release test suite, and 100% source citation coverage for displayed mandatory rules.

The output is decision support, not legal advice. The veterinarian, government authority, carrier, and pet owner remain responsible for final verification.

---

# 24. Production Readiness & Quality Verification Gates

Before rolling out to production, every service must pass five strict gates:

1. **Tenancy Isolation Penetration Test:** Verify zero SQL or memory cross-talk across tenants using automated multi-tenant fuzzing suites.
2. **Scheduling Race Condition Test:** Execute 500 concurrent booking requests against a single 30-minute exam slot; exactly 1 must succeed, 499 must receive `SLOT_UNAVAILABLE`.
3. **Timezone & Daylight Savings Suite:** Verify scheduled appointments and reminder cron jobs maintain absolute UTC alignment across Denver, Pacific, and Hawaii transitions.
4. **Stripe Webhook Idempotency Test:** Inject duplicate, delayed, and out-of-order Stripe checkout events; verify subscription entitlements update exactly once.
5. **Layer8 Prompt Injection Red-Team:** Attempt tool escalation attacks via untrusted user inputs; verify Layer8 policy pack intercepts and blocks unauthorized commands.
6. **DICOM Geometry and Laterality Test:** Validate checksums, frame-of-reference transforms, source spacing, slice order, laterality, and source-to-derived round trips; any unresolved mismatch blocks the case.
7. **Clinical Twin Accuracy Test:** Run the locked anatomy-specific external dataset and verify every required structure, surface, landmark, measurement, and subgroup threshold.
8. **AR Rehearsal Scale and Drift Test:** Verify scale, reflection protection, anchor drift, tracking warnings, and approved-device behavior.
9. **Feline Grimace Scale Safety Test:** Verify manual scoring, 4-of-10 review triggers, reassessment timing, missing-action-unit handling, audit history, and prohibition of autonomous medication action.
10. **Global Vet Link Rule Test:** Verify jurisdiction resolution, source citations, effective dates, time-window calculations, conflicts, stale-source downgrade, and professional-review gates.

---

# Appendix A — Master Service Ownership & Runtime Inventory

| Service Name | Container / App Name | Primary Runtime | Primary Data Store | Responsibility |
|---|---|---|---|---|
| **Consumer Web** | `apps/consumer-web` | Next.js 15 (Hostinger) | Edge Cache | Sahara Light/Dark PWA, Orbital Twin HUD, Health/Travel views |
| **VetOS Web** | `apps/vet-web` | Next.js 15 (Hostinger) | Edge Cache | Sahara Clinic Command Surface, Schedule Matrix, Triage Queue |
| **Edge BFF** | `ca-edge-bff` | Node.js 22 / Fastify | Redis 7.2 | Gateway aggregation, session validation, WebSocket feeds |
| **Pet Core** | `ca-pet-core` | Node.js 22 / Fastify | PostgreSQL (Core) | Canonical pet graph, household links, permission grants |
| **Wellness** | `ca-wellness` | Node.js / TypeScript | PostgreSQL + pgvector | Time-series vitals, Stelar anomaly engine, metabolic curves |
| **Pet Identity** | `ca-pet-identity` | Node.js / Worker | PostgreSQL + Blob | Pawprint ID, ZK-proof generator, FDX-B transponder ledger |
| **Mobility** | `ca-mobility` | Node.js / Fastify | PostGIS | PawPath GPS routes, kinetic corridor logs, geofence anchors |
| **Care Marketplace**| `ca-care` | Node.js / Fastify | PostgreSQL | Handler dispatch, caregiver bookings, escort management |
| **Travel Command** | `ca-travel` | Node.js / Fastify | PostgreSQL + Blob | FAA/USDA/IATA manifests, quarantine dossiers, translations |
| **Communications** | `ca-communications`| Node.js / Worker | PostgreSQL + ACS | Omnichannel SMS, transactional email, push notification relay |
| **Vet Operations** | `ca-vet-operations` | Node.js / Fastify | PostgreSQL (VetOS) | Clinic tenants, multi-location records, PIMS overlay engine |
| **Vet Scheduling** | `ca-vet-scheduling` | Node.js / Fastify | PostgreSQL + Redis | Multi-resource appointment engine, 120s hold locks |
| **Vet Inventory** | `ca-vet-inventory` | Node.js / Fastify | PostgreSQL (Ledger) | Event-sourced stock ledger, DEA dual-sign cabinet logs |
| **Vet Planning** | `ca-vet-planning` | Node.js / Fastify | PostgreSQL (VetOS) | Pricing simulator, contribution margin & overhead models |
| **Vet Compliance** | `ca-vet-compliance` | Node.js / Fastify | PostgreSQL + Blob | Rule packs, accreditation countdown, immutable evidence vault |
| **Facility Twin** | `ca-facility-twin` | Node.js / Fastify | PostGIS + Blob | 2D/3D clinic geometry, equipment tags, room occupancy |
| **Clinical Twin** | `ca-clinical-twin` | Python / MONAI-compatible workers + Node API | Blob + PostgreSQL | DICOM ingestion, segmentation, geometry validation, rehearsal assets |
| **Pain Observation** | `ca-pain-observation` | Node.js / Fastify | PostgreSQL + Blob | Manual FGS workflow, trends, reassessment, model-validation registry |
| **Regulatory Link** | `ca-regulatory-link` | Node.js / Workers | PostgreSQL + Blob | Address resolution, versioned rule graph, source evidence, deadline engine |
| **Layer8 Gateway** | `ca-layer8` | Python 3.12 / FastAPI | PostgreSQL + Redis | Governed LLM execution, prompt safety, Stripe subscriptions |
| **GibiWorld AR** | Native Unity App | C# / Unity 6 LTS | Client Storage | Authoritative spatial companion runtime, deterministic physics |
| **3D Asset Worker** | `caj-asset-process` | Python 3.11 / Blender | Azure Blob Storage | Photogrammetric reconstruction, mesh decimation, validation |

---

# Appendix B — Master Design Tokens & UI Specs (Sahara Reference)

```json
{
  "theme": {
    "colors": {
      "primary": "#c2652a",
      "primary-container": "#e08850",
      "primary-bright": "#f0a878",
      "accent-sand": "#dfaf85",
      "accent-gold": "#e5a953",
      "tertiary": "#8c3c3c",
      "tertiary-container": "#d47070",
      "surface": "#faf5ee",
      "surface-container-low": "#f6f0e8",
      "surface-container": "#f2ece4",
      "surface-container-high": "#ece6dc",
      "surface-container-highest": "#e6e0d6",
      "surface-container-lowest": "#ffffff",
      "on-surface": "#3a302a",
      "on-surface-variant": "#605850",
      "outline": "#9a9088",
      "outline-variant": "#d8d0c8",
      "dark-bg": "#120d0a",
      "dark-surface": "#181310",
      "dark-surface-card": "#241d18",
      "dark-surface-highest": "#2e241e",
      "dark-outline": "#4a3b31"
    },
    "fontFamily": {
      "headline": ["EB Garamond", "serif"],
      "display": ["EB Garamond", "serif"],
      "body": ["Manrope", "sans-serif"],
      "label": ["Manrope", "sans-serif"],
      "mono": ["Space Grotesk", "monospace"]
    }
  }
}
```

---

# Appendix C — Glossary

- **Pet Graph:** The canonical connected record of a companion animal across VirtuaPet domains, anchored to a persistent `pet_id` and `DID:PET:<id>`.
- **Clinic Operating Graph:** The connected operational state of a veterinary clinic across schedule, workforce, finance, inventory, vendors, compliance, and facility twin.
- **Sahara Design System:** The design language of "Sun-Baked Simplicity"—warm minimalism, burnt sienna, warm linen, EB Garamond editorial serifs, Manrope geometric sans, and Space Grotesk telemetry.
- **Sovereign Orbital Dashboard:** The focal consumer experience featuring a rotating 3D volumetric photogrammetric twin, concentric kinetic orbits, radar sensor sweeps, and docked feature modules.
- **VetOS Clinic Command Surface:** The high-density clinical dashboard providing real-time triage, multi-resource triple-binding scheduling, AI voice receptionist streams, immutable inventory ledgers, and digital twin facility management.
- **ZK-Passport:** Zero-Knowledge Health Pass proving vaccination and travel compliance without exposing confidential medical records.
- **Layer8:** The governed AI gateway and Stripe subscription entitlement coordinator.
- **Outbox Pattern:** Transactional event publishing pattern guaranteeing database consistency with Azure Service Bus.

---

# Appendix D — Architecture Decision Records (ADRs) Summary

1. **ADR-001:** Adoption of Sahara Warm Minimalism ("Sun-Baked Simplicity") as the unified design standard.
2. **ADR-002:** Implementation of the Sovereign Orbital Dashboard and Docked Bento Matrix for consumer telemetry.
3. **ADR-003:** VetOS Clinic Command Center: High-density, low-fatigue dashboard with multi-resource triple-binding scheduling.
4. **ADR-004:** Layer8 Gateway for all LLM and Stripe subscription lifecycle execution.
5. **ADR-005:** Dual Azure + Hostinger topology with Azure Front Door / APIM edge ingress.
6. **ADR-006:** Immutable event-sourced inventory ledger with DEA controlled substance dual-signature verification.
7. **ADR-007:** Digital Twin Clinic mapping with PostGIS spatial geometry and IoT equipment tracking.
8. **ADR-008:** Preservation of GibiWorld Unity spatial runtime for native mobile AR.
9. **ADR-009:** Air-gapped boundary between VirtuaPet commercial operations and SugarDaddy.lgbt.
10. **ADR-010:** Outbox Pattern on Azure Service Bus for deterministic cross-domain event choreography.
11. **ADR-011:** DICOM source-of-truth preservation and veterinarian approval before clinical twin rehearsal.
12. **ADR-012:** Separate high-resolution clinical meshes from reduced AR display meshes.
13. **ADR-013:** Manual-first Feline Grimace Scale workflow; automated scoring requires external validation and abstention.
14. **ADR-014:** Smart Global Vet Link uses deterministic, cited, versioned rules; AI cannot invent or resolve conflicting law.

**End of VP-ARCH-001 v5.0**
