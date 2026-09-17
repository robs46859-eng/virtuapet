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
- Identity-link rehearsal is enabled on healthy revision
  `virtuapet-staging-api--linkson`; `LAYER8_POLICY_ENABLED=true` is serving at 100% traffic on healthy revision `virtuapet-staging-api--policyon`.
  Both real tenant links and a correct-tenant signed policy allow now pass; the
  remaining revocation, cancellation, and outage drills are listed below.
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
- [x] Create and consume one signed link challenge for each organization. Both
  links returned HTTP 201; reciprocal Clerk/VirtuaPet tenant mismatches, expired
  proof, and replayed completion were denied. Consent revocation remains an
  operational drill.
- [x] Deploy healthy Layer8 `--vpon` and VirtuaPet `--linkson` rehearsal
  revisions while keeping policy enforcement disabled; anonymous requests
  continue to fail closed.
- [x] Prove a correct-tenant signed policy allow for Staging A and signed
  cross-tenant/expired-proof denials. The allow returned the exact
  `spatial.preview` entitlement under `virtuapet-nonclinical-v1`.
- [ ] Complete API-key revocation, billing cancellation, consent revocation, and
  Redis/Layer8 outage fail-closed operational drills.
- [x] Enable identity links first and policy enforcement second. Revision
  `virtuapet-staging-api--policyon` is healthy at 100% traffic; `/healthz` and
  `/readyz` return 200 and anonymous integration access returns 401. The prior
  `--linkson` revision remains available at 0% for rollback.

## Zero-dollar live Stripe staging activation

Both mapped Layer8 tenants have separate live-mode Stripe Business subscriptions
at $0/month using staging-only price `price_1UGnnu6X8IBUtLKfGuu7Zk7f`. Real signed
Stripe subscription webhooks set both accounts to Business/Active and granted
`spatial_intelligence`; no card was collected and no charge was made. The public
pricing labels remain the commercial $299/month Business price. Before commercial
production, restore the paid price reference or move staging billing into a
dedicated Stripe test account, and cancel the two zero-dollar staging subscriptions
when the acceptance program ends.

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


## DICOM implementation checkpoint

The D1 offline worker foundation is implemented in `services/dicom-worker`:
actual native classic CT pixel decoding, HU rescaling, source-position geometry,
LPS/RAS affines, bounded inputs and explicit unsupported-format rejection.
All 21 synthetic-file tests pass locally; dependency versions are locked and a
separate CI job runs the worker tests. This is engineering evidence, not clinical
validation or a deployed ingestion service.

- [x] Detailed [implementation architecture](../architecture/DICOM_IMPLEMENTATION_SPEC.md).
- [x] D1 offline CT decoding foundation and synthetic regression tests.
- [ ] D2 authenticated upload, private quarantine, isolated jobs and durable manifests.
- [ ] D3 MR/enhanced CT/compression and veterinary orientation profiles.
- [ ] D4 measured segmentation, mesh generation and export validation.
- [ ] D5 source-linked viewer, clinician corrections and approval workflow.
- [ ] D6 procedure-specific clinical validation and release review.

Existing Node imaging outputs remain prototypes. Never use them as fallback
clinical results. No production imaging endpoint or cloud deployment was added.
