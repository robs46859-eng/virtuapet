# VirtuaPet production status and remaining phases

Status captured: 2026-09-17 during the authorized SALTI8/Layer8 API cutover.

## Current verified state

- VirtuaPet keeps Microsoft Entra authentication. Clerk is used only by
  SALTI8/Layer8.
- Immutable API image
  `ghcr.io/robs46859-eng/virtuapet-api:0e456a2ee02782d9896a7417a39668a6f5fdda33`
  runs in healthy revision `virtuapet-staging-api--0000003` at 100% traffic;
  health, dependency readiness, exact browser CORS, and anonymous denial pass.
- VirtuaPet Staging A UUID `62335dff-756b-47a7-ba94-95e240c3680d` is assigned
  to accepted Entra guest `rob@virtuapet.com` and maps to Layer8 tenant
  `salti8-staging-a`.
- VirtuaPet Staging B UUID `6d8bed91-b840-4884-9ecb-907b4cf0c65f` is assigned
  to accepted Entra guest `robs46859@gmail.com` and maps to Layer8 tenant
  `salti8-staging-b`.
- Each organization has a distinct server-side Layer8 key scoped only to
  `virtuapet:policy`. The tenant-key map, link-encryption key, and Layer8 public
  verification material are stored through Key Vault references.
- `LAYER8_IDENTITY_LINKS_ENABLED` and `LAYER8_POLICY_ENABLED` remain disabled.
  No production authorization claim should be made until the real two-tenant
  link and policy drills pass.
- The Entra application exposes the delegated `access_as_user` scope and
  registers both VirtuaPet SPA origins. Hostinger serves the Entra-enabled web
  client, and the API uses verified Entra `oid` plus server-checked organization
  membership.
- Two simultaneous Firefox sessions now provide live browser evidence for the
  intended Entra guests. `rob@virtuapet.com` succeeds for Staging A and is
  denied for Staging B with `active_membership_required`;
  `robs46859@gmail.com` succeeds for Staging B and receives the same denial for
  Staging A. Both sessions were restored to their assigned organizations after
  the reciprocal negative tests.

## Remaining activation checklist

- [x] Entra invitations accepted for two separate staging users.
- [x] Separate VirtuaPet organizations, canonical UUIDs, Layer8 tenant mappings,
  and least-privilege policy credentials provisioned.
- [x] Migration 005 and the immutable Layer8-capable VirtuaPet API deployed.
- [x] Managed verification and link-encryption material attached without
  placing private credentials in browser code or source control.
- [x] `https://api.salti8.com` managed TLS, public Layer8 health/readiness,
  anonymous denial, exact CORS, and signed webhook delivery pass.
- [x] Entra-enabled Hostinger bundle and matching immutable Azure API revision
  deployed; public health/readiness, CORS, anonymous denial, and a wrong-account
  membership denial pass.
- [x] Sign in to VirtuaPet as both Entra guests, retain one authenticated
  session per VirtuaPet organization, and prove reciprocal wrong-organization
  membership denial.
- [ ] Create and consume one link challenge for each organization, proving that
  a changed subject, changed tenant, expired proof, replayed proof, and revoked
  consent are denied.
- [ ] Prove a correct-tenant signed policy allow and signed-policy cross-tenant
  denials, then prove API-key revocation, billing cancellation, and
  Redis/Layer8 outage fail closed. The browser membership denials above do not
  replace these Layer8 protocol tests.
- [ ] Enable identity links first and policy enforcement second, capture fresh
  health/readiness and authenticated acceptance evidence, and keep the prior
  immutable revision available for rollback.

## Remaining build-out phases

1. **Integration activation:** finish the two-tenant Entra-to-Clerk proof flow,
   tenant isolation, expiry, replay, revocation, billing, and outage drills.
2. **Phase 4 operational closure:** complete authenticated end-user workflows,
   Azure legacy-table RLS verification, backup restore, alert delivery, and
   incident recovery.
3. **Provider integrations:** establish provider-owned contracts, scoped
   credentials, consent, and verified identity links for Pawsome3D and PawPath.
   GibiWorld still has server preflight only; Judy and Stelar are not connected.
4. **Clinical twin build-out:** implement real DICOM pixel processing,
   segmentation and mesh measurement, representative retrospective validation,
   external veterinary review, and physical headset verification.
5. **Clinical and commercial production:** complete prospective multi-center
   evidence, regulatory and security review, production operations, and staged
   marketplace delivery. Current clinical results are engineering evidence and
   do not establish clinical effectiveness.

VirtuaPet is deployed and dependency-ready with live two-account Entra
organization isolation and the Layer8 integration prepared server-side. Full
production readiness remains open because identity-link and signed-policy
activation, Phase 4 operational evidence, provider contracts, and clinical
validation phases are not yet complete.
