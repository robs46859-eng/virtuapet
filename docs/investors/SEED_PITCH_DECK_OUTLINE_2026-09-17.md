# VirtuaPet — $4M seed investor pitch outline

Date: September 17, 2026. Working investor draft; USD throughout.

**The ask: $4 million in seed financing**, confirmed by the founder. Proposed use: 24 months to turn the existing engineering foundation into a reliable clinic-and-owner MVP, establish paid pilot evidence, and validate a tightly scoped imaging workflow. Valuation, instrument, ownership offered, and financing fees are not yet confirmed.

The funding target is confirmed; the budgets, prices, customer counts, and revenue below are new planning assumptions, not actual results or approved commercial terms. Cash balance, debt, historical expenditure, signed customers, revenue, and current headcount have not been supplied. This is an outline and an illustrative operating model, not a revised audited financial statement or an updated Excel workbook.

## Main deck — 15 slides

| Slide | Investor headline | Content and suggested visual |
|---|---|---|
| 1. Company and raise | One pet record connecting owners and veterinary care | VirtuaPet Consumer + VetOS; $4M seed ask; actual product screenshot labeled engineering pilot. |
| 2. Problem | Pet care loses time between disconnected records and workflows | Owner-to-clinic journey: repeated entry, permission gaps, recalls, inventory, imaging handoffs. Add measured interview findings when available; no invented savings. |
| 3. Initial customer | Start with clinics that need better owner coordination | Independent clinics and selected referral/imaging design partners. Buyer: practice owner/manager; clinical approver: veterinarian; end user: staff and pet owner. Proposed discovery goal: 15 interviews and 3 signed design partners. |
| 4. Product | A permission-controlled pet profile powers practical clinic work | Show owner profile → scoped consent → appointment → clinic communication/recall → auditable update. Distinguish functional API workflow from complete customer UI. |
| 5. Full MVP | Deliver one usable owner-and-clinic loop | Group the full inventory below into identity, records/consent, clinic workflow, manual observations, evidence, billing, integrations, and operations. Put detailed status table in appendix. |
| 6. Build progress | The software foundation exists; commercial acceptance remains ahead | Engineering pilot features, PostgreSQL persistence, recorded Azure/Hostinger deployment work, Layer8 identity-link work, DICOM decoder. Use dates and commit evidence, not customer traction claims. |
| 7. Clinical expansion | Imaging is a staged extension with measurable release gates | CT ingestion → reviewed volume → segmentation → source-linked 3D → clinician-approved planning. Highlight offline decoder now; secure upload/viewer/real segmentation next. No claim of clinically validated twins or robotics. |
| 8. Market | Win a defined clinic segment before expanding the platform | Bottom-up sensitivity: 1,000 clinics × $499/month × 12 = $5.988M annual subscription opportunity at hypothetical full penetration. This is an arithmetic scenario, not a measured TAM. Replace clinic count with sourced reachable accounts before external circulation. |
| 9. Business model | Clinic subscriptions first; owner upgrades second | Illustrative $499/month average clinic subscription and $10/month paid household plan. Basic invited owner access can be free. Clinical usage and first-party marketplace economics enter only after validation and cost evidence. |
| 10. Go to market | Founder-led pilots become repeatable clinic onboarding | Three design partners → measured workflow pilot → paid conversion → referenceable clinics. Track activation, weekly use, staff time, support hours, churn, and sales cycle; targets are not achievements. |
| 11. Competition and advantage | Connect the care workflow without forcing a full PIMS replacement | Compare categories: PIMS, consumer record apps, imaging viewers, point AI tools. Show intended advantage: permissioned profile, workflow continuity, traceability. Named competitor claims require fresh research. No unsupported exclusivity or patent claims. |
| 12. Economics | A focused $4M plan replaces the earlier hardware-heavy model | Present the two-year base case, downside, spending ceiling, reserve, and recurring revenue exit rate below. Exclude robot sales and unvalidated clinical fees. |
| 13. Milestones and capital | Each funding tranche buys evidence | Four milestones over 24 months: operational closeout, pilot MVP, paid repeatability, narrow imaging validation. Include explicit exit tests, owner roles, and spending gates. |
| 14. Team | Build the team around clinic delivery and imaging quality | Verified founder biography only; add named staff/advisors only with confirmation. Hiring sequence: platform/full-stack, clinic implementation, imaging specialist, fractional veterinary/security/quality expertise. No implied advisor commitments. |
| 15. Investment ask | $4M to prove a repeatable clinic business | Recap target outcomes: usable MVP, paying and retained clinics, known onboarding/support cost, documented security operations, and bounded imaging evidence. Show financing terms as TBD and invite diligence. |

## Full MVP inventory and build notes

Scope labels: **Built** means repository engineering evidence; **Prototype** means partial contracts, adapters, or fixtures; **Remaining** means required completion or acceptance. None implies paying customers, full production readiness, or clinical authorization. This inventory defines the proposed seed MVP; later platform vision is listed separately so it is not silently promised at launch.

| MVP area | Features included | Current evidence / remaining acceptance |
|---|---|---|
| Sign-in and clinic authority | Entra sign-in for VirtuaPet; organization membership; admin/staff/veterinary roles; tenant isolation | Built identity and membership controls; recorded staging exercises. Complete full authenticated browser and failure matrix. Clerk remains exclusive to SALTI8/Layer8. |
| Owner experience | Pet creation/read, guardian ownership, profile selection, dashboard and clear capability labels | Built foundation; complete end-to-end owner UX, mobile/accessibility acceptance, edits and record lifecycle as required by pilot workflow. |
| Consent and records | Scope, purpose, effective dates, recipient access, list/revoke, guardian-bound data | Built core contracts/endpoints. Complete customer-facing document upload, retrieval, retention/deletion, and revocation exercises. Do not call this a complete longitudinal EMR. |
| Clinic workflow | Appointments, recalls, clinic messages, accountable authorship | Built basic records/API. Delivery providers, scheduling conflicts/resources, staff usability and real reminders require implementation/acceptance. |
| Inventory | Clinic-owned stock and validated nonnegative quantities | Built basic inventory. Reconciliation and usable stock workflow are MVP closeout; lot/expiry, controlled-drug registers and purchase orders are later expansion unless explicitly funded. |
| Manual feline observation | Five-action-unit FGS entry, trained-human confirmation, veterinarian review prompt and consent gate | Built manual workflow; veterinary content/usability approval outstanding. No automated diagnosis, prescribing or camera scoring claim. |
| Travel/regulation evidence | Provenance, reviewer-only verification, explicit unsupported/unknown states | Built evidence workflow. MVP coverage limited to explicitly verified sources; live jurisdiction adapters and maintained coverage remain work. No automatic clearance guarantee. |
| Billing and entitlement | Subscription onboarding, webhook handling, authorization, cancellation and audit | Integration/activation work recorded. Two $0 live-mode Layer8 subscriptions are test fixtures, not paying VirtuaPet customers. Validate VirtuaPet packaging, money flow, renewal/cancellation and customer access before commercial acceptance. |
| Layer8 governance | Separate identity providers, explicit account linking, scoped policy decisions, consent and audit boundaries | Link/policy engineering and staging evidence exist. Finish signature, tenant mismatch, replay, expiry, revocation and dependency-outage scenarios with valid independent inputs. |
| External product connections | Capability-aware Pawsome3D/PawPath adapters; GibiWorld manifest preflight | Prototype/adapters. Real provider contracts, consent links and interoperability required. Display unavailable states until connected; do not claim inherited products are integrated MVP features. |
| Persistence and operations | PostgreSQL, migrations, least-privilege roles, health/readiness, deployment/rollback, secret references | Built engineering foundation and historical staging evidence. Complete restore, alert delivery, replica persistence, monitoring ownership, support and incident playbooks. |
| Security and quality | Server authority, consent checks, audit provenance, automated checks, honest UI states | Built controls with remaining independent security, privacy, accessibility and real customer acceptance. No blanket compliance certification. |
| Imaging foundation — separate pilot gate | Strict classic CT pixel decoding, HU volume, source lineage and LPS/RAS affine | Offline library implemented; 21 synthetic-file tests recorded. No production upload, decoder isolation, de-identification, viewer, real segmentation or clinical use. Unsupported MR, compression, multiframe and quadruped semantics currently rejected. |
| Clinical planning prototype — separate pilot gate | Study/model contracts, review state, correction lineage, TPLO planning records, signed spatial delivery | Prototype only. Synthetic metric fixtures are not patient evidence; real mesh, validated measurements and hardware acceptance remain outstanding. |

### Later build-out, outside the core seed MVP promise

- Bidirectional production PIMS/RIS/FHIR/HL7/PACS integrations and broad vendor coverage.
- Full procurement marketplace, vendor/PO management, lot/expiry and controlled-medicine workflows; first-party marketplace direction supersedes older Shopify descriptions.
- AI voice/front desk, advanced pricing/overhead simulation and clinic facility twins.
- Wearables, biometric Pawprint ID, NFC and private health proofs beyond existing consent records.
- Full walking/safety, caregiver bookings, translation, emergency and international travel services through verified partner integrations.
- Automated segmentation, broad CT/MR support, quantitative clinical twins, physical AR rehearsal and patient-specific instruments, each with separate validation gates.
- Robot simulation, hardware-in-the-loop, cadaver studies and supervised clinical robotics. No robot revenue or autonomous surgery in this seed model.

## Updated financial plan — $4M seed

### Reconciliation with previous materials

The September 13 VirtuaPet workbook's base case projected $16.735M Year 3 revenue, approximately $39.551M cumulative three-year cash deficit and $45.484M minimum external capital including buffer, with 2,000 robot units in Year 3. Those are unvalidated expansion assumptions and cannot be funded by a $4M seed. The older illustrative $18M ask is also superseded by the founder's $4M instruction. Preserve the old workbook as historical; use this narrower model for this deck pending a replacement workbook.

### Proposed 24-month use of proceeds

| Workstream | Budget | Share | Deliverable |
|---|---:|---:|---|
| Core platform and product engineering | $1,600,000 | 40% | Usable owner/clinic workflows, secure billing and integration closeout |
| Imaging engineering and veterinary validation | $600,000 | 15% | Safe ingestion/viewing and a narrow research validation pipeline |
| Security, quality, privacy and legal | $400,000 | 10% | Reviewed controls, agreements, quality records and incident readiness |
| Cloud, tooling and integration delivery | $300,000 | 7.5% | Measured service costs, storage/jobs and supported connections |
| Clinic pilots, implementation and customer success | $450,000 | 11.25% | Repeatable onboarding and workflow evidence |
| Sales, administration and fundraising costs | $250,000 | 6.25% | Founder-led sales, finance and round costs |
| Unallocated contingency reserve | $400,000 | 10% | Runway protection; release only against evidence |
| **Total** | **$4,000,000** | **100%** | **$3.6M planned expenditure plus $0.4M reserve** |

The $3.6M envelope equals $150,000 average monthly expenditure over 24 months. It must include fully loaded compensation, vendors, infrastructure and delivery costs without double counting. Zero-revenue funding supports 24 months of planned spending with $400,000 left, or 26.7 months if that reserve is fully consumed at the same rate. Actual runway requires opening cash, liabilities, financing timing and monthly hiring/cash-flow detail. No profitability claim follows from this budget.

### Illustrative operating model

Years are consecutive 12-month periods after financing, not historical/calendar-year actuals. Customer averages are explicit annual assumptions, not derived forecasts of monthly cohorts. Exit ARR includes only recurring subscriptions at year-end; excludes pilots, one-time fees, imaging and hardware.

| Base-case input or output | Year 1 | Year 2 |
|---|---:|---:|
| Average paying clinics | 10 | 45 |
| Ending paying clinics | 20 | 70 |
| Average clinic subscription/month | $499 | $499 |
| Clinic subscription revenue | $59,880 | $269,460 |
| Average paying households | 250 | 1,250 |
| Ending paying households | 500 | 2,000 |
| Household price/month | $10 | $10 |
| Household subscription revenue | $30,000 | $150,000 |
| **Total recognized revenue assumption** | **$89,880** | **$419,460** |
| Assumed variable cost of revenue (25%) | $22,470 | $104,865 |
| **Gross profit assumption (75%)** | **$67,410** | **$314,595** |
| Total expenditure envelope, including cost of revenue | $1,650,000 | $1,950,000 |
| Remaining operating expenditure within envelope | $1,627,530 | $1,845,135 |
| **Net cash use, assuming same-period collection** | **$1,560,120** | **$1,530,540** |
| **Unspent seed cash, cumulative** | **$2,439,880** | **$909,340** |
| **Exit subscription ARR** | **$179,760** | **$659,160** |

Formulas: revenue = average paying accounts × monthly price × 12; exit ARR = ending paying accounts × monthly price × 12; cash use = total expenditure − collected revenue. Model assumes $4M gross funding at inception, no opening cash/debt, financing costs inside the budget, no capex outside it, no deferred collection, taxes, refunds or working-capital change. These simplifications require replacement before financing diligence. Gross margin is an assumption, not measured unit economics; higher service costs must trigger reprioritization or a shorter runway.

### Downside and upside sensitivity

Same prices, $3.6M expenditure ceiling and no incremental financing. Upside assumes capacity within that ceiling and must be stress-tested for support cost.

| 24-month scenario | Year 1 avg clinics / households | Year 2 avg clinics / households | Two-year revenue | Cash remaining after 24 months |
|---|---|---|---:|---:|
| No paid conversion | 0 / 0 | 0 / 0 | $0 | $400,000 |
| Conservative | 5 / 100 | 20 / 500 | $221,700 | $621,700 |
| Base | 10 / 250 | 45 / 1,250 | $509,340 | $909,340 |
| Upside | 15 / 400 | 70 / 2,000 | $796,980 | $1,196,980 |

Do not publish CAC, LTV, churn, payback, NRR, profitability or valuation multiples as facts before cohort evidence exists. As a cost ceiling example, 12-month gross-profit payback at $499/month and 75% margin implies no more than $4,491 fully loaded clinic acquisition cost; this is arithmetic sensitivity, not observed CAC.

## Milestones financed by the seed

| Period | Milestone and accountable role | Exit evidence | Proposed expenditure |
|---|---|---|---:|
| Months 0–3 | M1: operational closeout — platform lead | Full two-tenant failure matrix, restore/alert drills, billing lifecycle, browser acceptance, three design-partner agreements target | $350,000 |
| Months 4–9 | M2: usable pilot MVP — product/clinic implementation leads | Owner consent-to-clinic workflow, staff training, real reminders, usable inventory, verified evidence workflow; measured activation and support hours | $750,000 |
| Months 10–15 | M3: paid repeatability — commercial/platform leads | Paid conversion and retention cohorts, price/cost validation, narrow supported integration; secure imaging ingestion/viewer pilot gated separately | $1,050,000 |
| Months 16–24 | M4: expansion evidence — imaging/veterinary/product leads | Target 70 ending paying clinics and 2,000 paying households in base case; source-linked imaging validation report, safety/rejection evidence, next-round readiness | $1,450,000 |
| Held separately | Contingency — founder/finance | Released only after budget review | $400,000 |

These are targets, not promises. Quarter-level spending must be reconciled to a hiring plan. M1–M2 total $1.1M, followed by $0.55M in months 10–12 and $0.5M in months 13–15, matching the annual budget. If onboarding or validation fails, narrow the release and preserve the reserve rather than assume clinical launch or hardware sales.

## Diligence appendix and source register

- Current source baseline: `869b9b4c9761de77973451fc3974c61652dfdbb1`, DICOM decoding foundation and architecture. Source publication does not establish live deployment of the worker.
- [Phase 2 engineering acceptance](../product/PHASE_2_ACCEPTANCE.md): core features and external acceptance boundaries.
- [Phase 3 prototype acceptance](../product/PHASE_3_ACCEPTANCE.md): contracts and synthetic fixtures; do not quote synthetic Dice, usability or hospital metrics as clinical results.
- [Phase 4 engineering acceptance](../product/PHASE_4_ACCEPTANCE.md): persistence/spatial foundation and historical staging evidence.
- [Current project status](../product/PRODUCTION_STATUS_AND_REMAINING_PHASES_2026-09-17.md): dated operational notes; no new live re-verification performed for this deck.
- [DICOM architecture](../architecture/DICOM_IMPLEMENTATION_SPEC.md) and [decoder README](../../services/dicom-worker/README.md): actual implemented scope and next security boundary.
- [Robotics milestones](../product/ROBOTIC_SURGERY_SOFTWARE_MILESTONES.md): long-term phases, separate from MVP.
- Historical narrative: `outputs/VIRTUAPET_SEED_INVESTOR_PACKAGE_v2.md` in the parent project; historical financial evidence: `outputs/VIRTUAPET_THREE_YEAR_FINANCIAL_MODEL_v1.xlsx.inspect.ndjson`, Summary table. These source files are outside this repository and are not updated by this outline.

### Before sending externally

- [ ] Founder approves this narrower MVP scope, pricing assumptions and budget; $4M funding target already confirmed.
- [ ] Finance supplies bank cash, liabilities, actual burn, payroll, revenue/collections and cap table; builds a monthly model with churn and hiring cohorts.
- [ ] Confirm signed/paying clinics, pipeline and pilot permissions; exclude staging users and zero-dollar subscriptions from traction.
- [ ] Refresh deployed-version, CI and product-demo evidence; show real and prototype behavior distinctly.
- [ ] Obtain current market/competitor primary sources and a reachable-account list before claiming TAM or differentiation.
- [ ] Verify IP ownership, licenses, advisor commitments and related-party agreements. Layer8 revenues are not VirtuaPet revenue unless contractually attributable; nonprofit operations remain separate.
- [ ] Replace proposed clinical outcomes with measured evidence only after veterinary review. Remove all unsupported clearance/compliance claims.
- [ ] Agree financing instrument and valuation separately; this document does not set either.
