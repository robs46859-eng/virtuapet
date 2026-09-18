# VirtuaPets: MyPets Denver mock clinic

This directory is the branch-specific entry point for the private MyPets Denver
simulation. The branch is `virtuapets/denver-mock-clinic`; it remains part of
the VirtuaPet repository and does not represent a separate production product.

See [operating plan and setup evidence](../../docs/simulations/DENVER_MOCK_INITIAL_SETUP.md).

Run the current isolated checks:

```sh
node --test simulations/denver-mock/*.test.mjs
node simulations/denver-mock/plan.mjs
```

`config.json` is a proposed configuration, not an active deployment. `clock.mjs` is tested independently and is not wired into VirtuaPet or Stripe. The local ignored `.env.participants.json` contains the user-authorized recipient roster; it must never be included in a site bundle or Git. No passwords are stored. Do not enable mail or seed a shared live tenant from this scaffold.

Initial integration sequence: protect root website → verify TLS/anonymous denial → deploy private landing → provision dedicated Entra-backed clinic → seed guardian-owned pets and explicit consent → bind Denver Mock Stripe credentials → verify one mail round trip → run feature and failure matrix. Mark a result passed only with actual returned records or received messages.

Deployment note (September 18): Hostinger editor saved a compact equivalent of site/index.html after direct upload was unavailable. The persisted remote page has the same setup boundaries; root and index.html both return 401 anonymously. Authenticated Chrome rendering was visually confirmed across the complete page, including all simulation and capability-boundary notices.

The operator handoff is [DENVER_MOCK_HANDOFF.md](../../docs/simulations/DENVER_MOCK_HANDOFF.md).

`plan.mjs` validates the safe defaults and emits a deterministic, pseudonymous
workflow plan. It performs no network calls, creates no accounts, sends no mail
and creates no Stripe objects. Its output is planning evidence, not execution
evidence.
