# MyPets Denver simulation handoff

**Branch:** `virtuapets/denver-mock-clinic`

**Repository:** `robs46859-eng/virtuapet`

**Date:** September 18, 2026

**State:** private simulation foundation; no real clinical operation

## Purpose

This branch exercises VirtuaPet as the practice system for a fictional Denver
primary-care clinic. The clinic refers invasive procedures and uses accelerated
business time, authorized test participants, Hostinger private hosting and the
existing Denver Mock Stripe sandbox. It must never be presented as a licensed
clinic, a real patient record system, or a clinically validated product.

## Completed and verified

- Hostinger provisioned `mypets.cc` on the existing Business plan.
- HTTPS certificate verification succeeded.
- The owner enabled password protection for `/`; anonymous requests to `/` and
  `/index.html` return HTTP 401.
- Hostinger saved `public_html/index.html`; the file persisted after an editor
  reload. Authenticated visual rendering was confirmed in Chrome on September
  18, 2026: the complete page rendered without visible layout breakage, including
  the private-simulation badge, simulation-only warning, referral scope,
  privacy statement, setup status, accelerated-time boundary, imaging boundary
  and footer disclaimer.
- Login to the designated clinic mailbox succeeded.
- Stripe showed the **Denver Mock** account in sandbox mode with zero balance.
- The local 60x business-event clock passed its isolated tests. It starts
  paused and does not alter authentication, webhook or audit time.
- The eight authorized participant addresses are stored in the ignored local
  `.env.participants.json`; no passwords or recipient addresses are committed.
- Microsoft Entra contains all eight authorized participant identities. The
  invitation operation was completed on September 18, 2026.
- VirtuaPet organization `a8d2aeaa-8aaa-4fb8-9180-5e7591dd6b99` is provisioned
  as **MyPets Denver Veterinary Clinic (Simulation)** with one `clinic_admin`
  membership and seven distinct `guardian` memberships. `rob@stelar.host` is
  the administrator and is therefore not duplicated as a guardian.
- The one-time Azure provisioning job completed successfully and was deleted.
- All participant invitations are accepted. On September 18, 2026, the live
  `tipsygaymer@solamaze.com` session selected the Denver organization and the
  API returned **Authenticated for MyPets Denver Veterinary Clinic —
  Simulation**.
- The refreshed clinical dashboard and its one-page user guide are deployed to
  `virtuapet.com`. The public CSS, JavaScript, and PDF SHA-256 hashes matched
  the verified local production build after publication.

## Repository artifacts

- [Initial setup and compliance register](DENVER_MOCK_INITIAL_SETUP.md)
- [Branch README](../../simulations/denver-mock/README.md)
- `simulations/denver-mock/config.json`: proposed private/sandbox settings
- `simulations/denver-mock/clock.mjs`: isolated simulation clock
- `simulations/denver-mock/clock.test.mjs`: clock safety checks
- `simulations/denver-mock/site/index.html`: source landing page
- `apps/web`: refreshed pilot dashboard with the Denver simulation selector
- `output/pdf/virtuapet-dashboard-update-guide.pdf`: one-page update guide

## Exact boundaries

- Separate authenticated Denver-session evidence remains to be captured for
  the other participant identities; one accepted guardian account is verified.
- No fictional pet has been submitted to a deployed API.
- No Stripe customer, product, subscription, invoice, payment, refund or test
  clock has been created for this clinic.
- Outbound mail is disabled. No workflow email has been sent.
- Provider adapters, DICOM and surgical-planning artifacts remain prototype or
  research paths and are not clinical services.
- Regulatory sources are an applicability register. No permit, professional
  license, parcel approval or compliance certification has been obtained.

## Continue in this order

1. Verify the remaining participant identities sign into the Denver simulation
   with distinct Entra sessions; one accepted guardian account already passes.
2. Bind Denver Mock sandbox keys through a secret reference. Map Stripe Price
   IDs to internal entitlements; do not commit keys and do not use Payment Link
   IDs as entitlement identifiers.
3. Seed the eight fictional pets through authenticated API routes and capture
   returned IDs in an ignored run artifact.
4. Run consent, appointment, recall, message, inventory, manual FGS and
   regulation-evidence workflows, including cross-tenant and revoked-consent
   denials.
5. Verify one `[SIMULATION]` mail round trip before enabling allowlisted
   correspondence. Never send passwords or clinical claims.
6. Exercise sandbox billing success, decline, cancellation and refund with
   Stripe-supported test time. Application accelerated time does not advance
   Stripe.
7. Build and deploy the dashboard update only after its local build, responsive
   visual review, PDF inspection, and authenticated organization check pass.
8. Produce an evidence report that separates repository tests, deployed API
   responses, received messages and visible browser results.

## Rollback and recovery

- Disable or remove the Hostinger root protection only by explicit owner
  decision; the current safe state is private and anonymous-denied.
- Outbound mail defaults to disabled in `config.json`.
- Do not modify the existing VirtuaPet staging organizations or Layer8 live
  subscription fixtures for this simulation.
- Remove the Denver organization and memberships together if the simulation is
  retired; never leave orphaned access grants.
- If environment identity is uncertain, stop before tenant creation and record
  the account, subscription, tenant, application and target API revision.
