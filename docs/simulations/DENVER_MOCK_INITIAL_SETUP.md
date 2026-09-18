# MyPets Denver — private clinic simulation

Created September 18, 2026. Owner-authorized simulation using VirtuaPet, Hostinger and the existing **Denver Mock** Stripe sandbox. No real clinic, clinician license, patient encounter, permit, prescription or referral partnership is asserted. All encounters, certificates and messages must carry `SIMULATION — NOT VALID FOR CLINICAL OR LEGAL USE`.

## Clinic operating model

Working name: MyPets Denver Veterinary Clinic (Simulation). Domain: mypets.cc. Correspondence: designated Randy mailbox on that domain. All eight owner-supplied participant addresses are authorized for simulation correspondence; keep the address roster and passwords outside Git. Patient accounts must remain Entra-backed, matching VirtuaPet's identity architecture; a shared password does not create server-side clinic membership.

Provisional capacity: 3,800 square feet, four exam rooms (including a quiet feline room), two veterinarian roles per shift, three technician roles, two assistant roles, two reception roles and one practice manager. Weekdays 08:00–18:00 America/Denver; 28 scheduled appointments/day (14 per veterinarian), plus protected documentation, urgent assessment and referral coordination time. Eight fictional households seed the first workflow run; they do not represent a full patient panel or capacity test.

**Benchmark gap:** These are design assumptions, not a measured Colorado/Denver median. The AVMA 2025 national report provides staffing and appointment averages; it explicitly cautions that local markets vary. Obtain a representative Denver/Boulder/Aurora/Fort Collins/Colorado Springs general-practice dataset before claiming a regional median. Exclude referral hospitals and university facilities from that comparison. Do not substitute national averages or a handful of large hospitals for the requested median.

Service scope: simulated primary care, wellness, preventive-care planning, nutrition, chronic-condition follow-up, manual feline pain observations, basic diagnostic results review, owner communication, records/consent, inventory and billing. Surgery, anesthesia, invasive dentistry, endoscopy, biopsies and advanced imaging acquisition are referral-only. Routine needle procedures are also referral-only initially to respect the requested non-invasive boundary; vaccine reminders may be recorded without pretending administration occurred. No overnight boarding, retail live animals, real drugs, actual laboratory submissions or real emergency response.

Referral loop: clinician flags need → owner approves record-sharing scope → fictional referral destination accepts case → external procedure represented by clearly labeled synthetic report → primary clinic records follow-up. Do not contact a real hospital or imply its participation without a separate agreement.

## Regulatory applicability register

This is an initial requirements register, not certification that every ordinance is satisfied. No physical address or licensed team has been selected, so site-specific compliance remains unverified. Never mark a permit or license as issued on the strength of a mock record.

| Area | Simulation behavior | Real-clinic gate and evidence |
|---|---|---|
| Colorado veterinary practice | Distinct veterinarian, technician, assistant, manager and guardian roles; no invented license numbers | Verify DORA licenses/registrations, scope, supervision, VCPR requirements and current Board rules before real care. Board primary pages could not be retrieved during this pass; current detailed provisions remain to verify. |
| Records and consent | Source, author, encounter time, corrections, consent scope, referral release and access audit | Confirm current retention, release, confidentiality and record-content rules against effective 4 CCR 727-1; do not guess retention periods. |
| Denver land use | Fictional location labeled Denver; no real street address or map pin | Parcel zoning/use permission, building/occupancy/fire/accessibility and signage review. Denver's animal-services definition includes veterinary care; allowed use depends on the parcel and code. |
| Animal welfare and local licensing | Intake checklist for species, rabies evidence, Denver license and special restrictions; unknown status routes to review | Verify current Denver animal ordinances, bite/quarantine/reporting process, nuisance controls and any animal-specific permit conditions. No fake government certificates. |
| PACFA | No boarding/daycare/breeding/sales in initial scope | Verify exemption and applicability with CDA if services change. Legislative summary identifies exemption for veterinary hospitals boarding animals for medical care; this is not a blanket exemption for commercial boarding. |
| Imaging | Synthetic DICOM only; referral acquisition | Verify CDPHE registration, radiation safety and facility obligations before any real X-ray equipment; none is commissioned here. |
| Medicines and waste | No real dispensing, controlled inventory, sharps or clinical waste | Determine pharmacy/DEA, storage, logging, disposal and worker-safety obligations if such services are added. |
| Business and employment | Staff and costs are fictional | Entity/tax registrations, insurance, employment rules, accessibility, consumer disclosures and local business-license applicability require review before operation. |
| Payments and email | Denver Mock only; recipient allowlist; explicit simulation subjects | No live charges; customer/account ids must be sandbox-specific; no participant passwords in messages or logs. |

Primary sources consulted September 18, 2026:

- [Denver animal ordinances](https://denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Animal-Shelter/Animal-Protection/Animal-Ordinances-and-Legislation).
- [Denver zoning use definitions](https://www.denvergov.org/content/dam/denvergov/Portals/646/documents/Zoning/DZC/Denver_Zoning_Code_Article11_Use_Limitations.pdf).
- [Denver plan review and permitting](https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Plan-Review-Permits-and-Inspections).
- [Colorado legislative PACFA summary](https://content.leg.colorado.gov/publications/colorado-pet-animal-care-and-facilities-act).
- [DORA 2025 veterinary law update](https://content.govdelivery.com/accounts/CODORA/bulletins/3e56093).
- [DORA laws and rules entry point](https://dpo.colorado.gov/Veterinary/Laws) — retrieval blocked; detailed current verification pending.
- [AVMA 2025 national practice report](https://ebusiness.avma.org/files/productdownloads/002_AVMA_SotPReport25_NoPasswordPRO.pdf), practice operations/workforce sections; national averages, not a regional median.

## Initial fictional cases

Participant addresses are stored only in the local ignored roster, indexed in the order supplied by the owner.

| Participant | Fictional pet | Species | Primary test |
|---|---|---|---|
| 01 | Aspen | Dog | Intake, profile, consent and wellness booking |
| 02 | Barkley | Dog | Inventory use, estimate and sandbox payment |
| 03 | Pixel | Cat | Manual FGS observation and clinician review |
| 04 | Summit | Dog | Referral for invasive procedure, record-sharing and return report |
| 05 | Mochi | Cat | Appointment reminder and rescheduling |
| 06 | Scout | Dog | Declined payment, retry and receipt |
| 07 | Juniper | Cat | Consent revocation and access denial |
| 08 | River | Dog | Recall, travel evidence marked needs-review, cancellation/refund |

## Use every available VirtuaPet feature without inventing capability

| Feature group | Exercise | Current setup status |
|---|---|---|
| Organizations, staff and Entra identities | Dedicated mock clinic, eight guardians; positive and denied access | Accounts/tenant not provisioned yet |
| Pets and consent | Create profiles, grants, expiry and revocation | API foundation exists; mock data not seeded |
| Appointments, recalls, messages | Book, notify, follow up and inspect authorship | Records available; actual delivery/automation must be tested separately |
| Inventory | Receive/use stock and reject invalid quantities | Foundation available; no physical purchasing |
| Manual FGS | Synthetic scores and clinician-review prompts | Engineering workflow; no actual pain assessment |
| Regulatory evidence | Source registry, reviewer action, stale/unknown denial | Workflow available; not a legal clearance engine |
| Layer8 links/policy | Separate identity providers, account consent, policy denial | Isolated sandbox wiring pending; leave existing live/staging settings unchanged |
| DICOM/planning | Offline synthetic CT test and labeled prototype review | Research-only; no clinical twin or robot operation |
| Pawsome3D/PawPath/GibiWorld | Test available adapter/preflight contracts | Real provider delivery cannot be marked passed until connected |
| Stripe lifecycle | Test customer, invoice/payment, decline/refund; repeat idempotently | Denver Mock sandbox verified in browser; no objects created yet |
| Operational readiness | Privacy, tenant denial, mail allowlist, backup and audit evidence | Dedicated environment and end-to-end verification remain pending |

## Clock contract

Initial multiplier: **60x** (one real minute equals one simulated hour). Start paused. Explicit advancement and a recorded real-time anchor make runs reproducible. Display real and simulated timestamps together. Only mock scheduling/recall events consume simulated time. Keep JWT/session validity, TLS, webhook signature freshness, provider rate limits and security/audit receipt timestamps on real time. Stripe test clocks must be advanced separately using supported sandbox workflows; no assumption that application time alters Stripe.

## Initial setup evidence and remaining gates

- [x] Owner chose private simulation and authorized all eight participant mailboxes.
- [x] Denver Mock selected in Stripe; visible sandbox banner and zero balance confirmed.
- [x] Randy Hostinger mailbox login succeeded.
- [x] mypets.cc PHP/HTML hosting provisioned on the existing Business plan, September 18, 2026.
- [x] Root directory authentication enabled by owner; anonymous HTTPS request returned 401 on September 18, 2026. Hostinger lists / as protected.
- [x] HTTPS certificate verification passed. After root protection was enabled, anonymous requests to `/` and `/index.html` returned 401 on September 18, 2026.
- [x] Private clinic landing HTML saved in Hostinger `public_html/index.html`, persisted after editor reload, and rendered successfully in an authenticated Chrome session on September 18, 2026. All status and safety notices were visible without layout breakage.
- [ ] Dedicated VirtuaPet environment/tenant and Entra staff/guardian identities provisioned.
- [ ] Sandbox credentials bound privately; no live Stripe settings reused.
- [ ] Seed eight fictional pets through authenticated routes and record returned ids.
- [ ] Confirm one labeled email round trip before enabling allowlisted workflow correspondence.
- [ ] Run each available feature; keep unsupported capabilities explicitly blocked.
- [ ] Complete failure paths and collect a per-step evidence report. Full workflow is not yet confirmed.
