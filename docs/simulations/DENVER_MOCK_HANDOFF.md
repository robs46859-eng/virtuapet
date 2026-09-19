# MyPets Denver simulation handoff

**Branch:** `virtuapets/denver-mock-clinic`

**Repository:** `robs46859-eng/virtuapet`

**Date:** September 19, 2026

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
- Merged commit `215a787a35d980e27c7f6ab8fc13a63ff9c77e9e` published the tested API image. Azure revision `virtuapet-staging-api--dm215a787` is healthy and receives 100% traffic.
- The `api.virtuapet.com` CNAME now points to the VirtuaPet Container App. Public health and readiness return HTTP 200 with OIDC and PostgreSQL ready.
- Eight fictional pets and eight consent grants were seeded transactionally after the seeder verified the exact Denver organization and each active membership.
- Azure Key Vault contains the Denver Mock test secret. Stripe acceptance run `b76f4e62-e77e-48ca-9725-360e613157f7` passed exact-account matching, test-mode object checks, zero-dollar subscription idempotent replay and cancellation, and an expected decline with zero successful charges.
- Mail run `mail-20260919T193828Z-c82c5492` passed allowlist, simulation-label, endpoint, message-ID and reply-thread verification using exported `.eml` evidence.
- A live `rob@stelar.host` clinic-admin session authenticated to Denver and was denied access to VirtuaPet Staging A with `active_membership_required`.

## Repository artifacts

- [Initial setup and compliance register](DENVER_MOCK_INITIAL_SETUP.md)
- [September 19 acceptance record](DENVER_MOCK_ACCEPTANCE_2026-09-19.md)
- [Branch README](../../simulations/denver-mock/README.md)
- `simulations/denver-mock/config.json`: proposed private/sandbox settings
- `simulations/denver-mock/clock.mjs`: isolated simulation clock
- `simulations/denver-mock/clock.test.mjs`: clock safety checks
- `simulations/denver-mock/site/index.html`: source landing page
- `apps/web`: refreshed pilot dashboard with the Denver simulation selector
- `output/pdf/virtuapet-dashboard-update-guide.pdf`: one-page update guide

## Exact boundaries

- Separate fresh authenticated Denver-session evidence remains to be captured for the remaining participant identities; one accepted guardian and one clinic administrator have positive evidence.
- The pet/consent seed was an administrative transactional fixture run inside the deployed container. Authenticated end-user create/read/revoke workflows still need a browser/API rehearsal.
- Stripe execution was test mode only. No live charge exists; the decline produced zero successful charges, so a refund test was neither possible nor appropriate.
- Application outbound mail remains disabled. The completed round trip was a manually initiated, allowlisted simulation message, verified from exported evidence.
- Provider adapters, DICOM and surgical-planning artifacts remain prototype or
  research paths and are not clinical services.
- Regulatory sources are an applicability register. No permit, professional
  license, parcel approval or compliance certification has been obtained.

## September 19 build checkpoint

- The API authorization update requires an active, non-revoked staff membership
  in the selected clinic organization for clinic operations. Feline assessment
  reads require both membership and the correct active consent scope.
- The deterministic fixture seeder validates the exact Denver organization,
  eight distinct guardians, least-privilege consent scopes, bounded expiry,
  replay consistency and transactional rollback.
- The Stripe harness accepts test keys only, verifies the exact Denver Mock
  account before mutation, uses idempotency keys, and exercises a zero-dollar
  subscription plus an expected decline without a successful charge.
- The mail harness prepares and verifies an allowlisted `[SIMULATION]` request
  and reply using exported `.eml` evidence; it contains no sending transport.
- Local validation passes: 262 API tests, 25 Denver tests, workspace typechecking
  and the production build. The deployed, provider and browser evidence above is
  recorded separately from those repository checks.

## Remaining acceptance work

1. Verify the remaining participant identities sign into the Denver simulation
   with distinct Entra sessions.
2. Run authenticated pet read and consent revoke/expired denial paths against
   the seeded fixtures. Preserve the fixture IDs only in ignored evidence.
3. Run consent, appointment, recall, message, inventory, manual FGS and
   regulation-evidence workflows, including cross-tenant and revoked-consent
   denials.
4. Add a runtime billing adapter only when product entitlement behavior is
   defined; keep the test secret in Key Vault and do not inject an unused secret
   into the API.
5. Rehearse backup restore, alert delivery, dependency outage and rollback.
6. Repeat local, CI, deployed API, provider and browser checks after changes.

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
