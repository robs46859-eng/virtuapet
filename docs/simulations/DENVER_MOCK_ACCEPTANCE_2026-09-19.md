# Denver Mock acceptance record — September 19, 2026

**Scope:** private, fictional clinic simulation. No real veterinary care, clinical authorization or production compliance claim.

## Passed evidence

| Gate | Evidence | Result |
|---|---|---|
| Source and CI | PR #1 merged as `215a787a35d980e27c7f6ab8fc13a63ff9c77e9e`; all required GitHub checks passed | Passed |
| API deployment | Immutable image `ghcr.io/robs46859-eng/virtuapet-api:215a787a35d980e27c7f6ab8fc13a63ff9c77e9e`; Azure revision `virtuapet-staging-api--dm215a787`; 100% traffic | Passed |
| Public routing | Hostinger `api` CNAME changed from Layer8 to `virtuapet-staging-api.niceground-f0c7cfe6.westus3.azurecontainerapps.io`; Azure managed certificate binding already existed | Passed |
| Health/readiness | `https://api.virtuapet.com/healthz` and `/readyz` returned HTTP 200; readiness reported OIDC and database available | Passed |
| Fictional records | Deployed-container seed completed transactionally for eight deterministic fictional pets and eight bounded consent grants after exact organization and active-membership checks | Passed as administrative fixture seeding |
| Stripe sandbox | Key stored as `denver-mock-stripe-test-secret-key` in `kv-virtuapet-stg-f7318c`; run `b76f4e62-e77e-48ca-9725-360e613157f7` finished at `2026-09-19T19:46:17.463Z` | Passed |
| Stripe assertions | Exact test account matched; returned objects were test mode; $0 monthly price; subscription replay returned the same object; subscription canceled; expected decline observed; zero successful charges; declined PaymentIntent canceled | Passed |
| Mail | Run `mail-20260919T193828Z-c82c5492`; `[SIMULATION]` request sent from the authorized clinic mailbox, received by an allowlisted participant, and replied with the required receipt marker | Passed |
| Mail evidence | Exported original/reply `.eml` files had distinct message IDs, correct endpoints and valid reply threading; safe-content checks passed | Passed |
| Authenticated positive | Live `rob@stelar.host` session selected MyPets Denver and displayed `Authenticated for MyPets Denver Veterinary Clinic — Simulation` | Passed |
| Live tenant denial | The same session selected VirtuaPet Staging A and received `active_membership_required` | Passed |
| Prior guardian evidence | Live `tipsygaymer@solamaze.com` Denver verification recorded September 18 | Passed at that checkpoint; refresh still required for a new release-wide matrix |
| Automated matrix | 262 API tests, 25 Denver tests, workspace typecheck and production build passed before image publication | Passed as engineering evidence |

No credential, authorization header, raw provider response or participant password is stored in Git. The Stripe result file remained in ephemeral Cloud Shell storage, and mail exports remain outside the repository.

## Evidence boundaries

- Administrative seeding proves the deployed code can validate memberships and persist the deterministic fixtures. It does not prove every guardian can create, read or revoke records through the end-user UI.
- The browser evidence proves one current administrator success and one current cross-tenant denial. Automated tests cover replay, expiry, revoked membership, consent denial and rollback behavior, but those tests are not fresh provider or browser evidence.
- The Stripe run proves the isolated Denver Mock sandbox lifecycle. There was no successful charge, so a refund was not created. The API does not yet contain a product billing adapter, so injecting the test key into its runtime would add exposure without behavior.
- The mail round trip proves authorized manual delivery and threading. Automated outbound workflow mail remains disabled.
- DICOM, segmentation, clinical twins, surgical rehearsal and robotics remain engineering or research stages and are not authorized clinical functions.

## Remaining gates

- [ ] Capture a fresh positive Denver session and a wrong-organization denial for each remaining guardian identity.
- [ ] Rehearse authenticated reads plus consent revocation, expiry and replay against the seeded fixtures.
- [ ] Execute appointment, recall, clinic message, inventory, manual FGS and regulation-evidence cases with the fictional records.
- [ ] Define billing entitlement behavior before adding a runtime Stripe adapter; then test webhook/order reconciliation as its own release.
- [ ] Rehearse database restore, alert delivery, dependency outage, rollback and incident ownership.
- [ ] Repeat the full matrix after any identity, consent, billing, mail or deployment change.

The Denver Mock clinic is open for controlled private simulation. VirtuaPet is not fully production ready for real clinical operation until the remaining operational, security, privacy, clinical-validation and regulatory gates pass.
