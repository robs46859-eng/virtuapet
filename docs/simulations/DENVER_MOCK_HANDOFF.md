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
  reload. Authenticated visual rendering remains a separate gate.
- Login to the designated clinic mailbox succeeded.
- Stripe showed the **Denver Mock** account in sandbox mode with zero balance.
- The local 60x business-event clock passed its isolated tests. It starts
  paused and does not alter authentication, webhook or audit time.
- The eight authorized participant addresses are stored in the ignored local
  `.env.participants.json`; no passwords or recipient addresses are committed.

## Repository artifacts

- [Initial setup and compliance register](DENVER_MOCK_INITIAL_SETUP.md)
- [Branch README](../../simulations/denver-mock/README.md)
- `simulations/denver-mock/config.json`: proposed private/sandbox settings
- `simulations/denver-mock/clock.mjs`: isolated simulation clock
- `simulations/denver-mock/clock.test.mjs`: clock safety checks
- `simulations/denver-mock/site/index.html`: source landing page

## Exact boundaries

- No dedicated VirtuaPet organization or Entra participants have been created.
- No fictional pet has been submitted to a deployed API.
- No Stripe customer, product, subscription, invoice, payment, refund or test
  clock has been created for this clinic.
- Outbound mail is disabled. No workflow email has been sent.
- Provider adapters, DICOM and surgical-planning artifacts remain prototype or
  research paths and are not clinical services.
- Regulatory sources are an applicability register. No permit, professional
  license, parcel approval or compliance certification has been obtained.

## Continue in this order

1. Have the owner authenticate to `https://mypets.cc` with the newly created
   site credentials, then verify the rendered page and its simulation notice.
2. Refresh Azure/Graph authentication. Create a dedicated Entra-backed
   VirtuaPet organization only after confirming the target environment and
   platform administrator identity.
3. Resolve eight participant Entra object IDs and create explicit guardian
   memberships. Never derive identity from a shared password or email alone.
4. Bind Denver Mock sandbox keys through a secret reference. Map Stripe Price
   IDs to internal entitlements; do not commit keys and do not use Payment Link
   IDs as entitlement identifiers.
5. Seed the eight fictional pets through authenticated API routes and capture
   returned IDs in an ignored run artifact.
6. Run consent, appointment, recall, message, inventory, manual FGS and
   regulation-evidence workflows, including cross-tenant and revoked-consent
   denials.
7. Verify one `[SIMULATION]` mail round trip before enabling allowlisted
   correspondence. Never send passwords or clinical claims.
8. Exercise sandbox billing success, decline, cancellation and refund with
   Stripe-supported test time. Application accelerated time does not advance
   Stripe.
9. Produce an evidence report that separates repository tests, deployed API
   responses, received messages and visible browser results.

## Rollback and recovery

- Disable or remove the Hostinger root protection only by explicit owner
  decision; the current safe state is private and anonymous-denied.
- Outbound mail defaults to disabled in `config.json`.
- Do not modify the existing VirtuaPet staging organizations or Layer8 live
  subscription fixtures for this simulation.
- If environment identity is uncertain, stop before tenant creation and record
  the account, subscription, tenant, application and target API revision.
