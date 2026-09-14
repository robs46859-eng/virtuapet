# VirtuaPet Threat Model

## Scope

This threat model covers the public web surface, API, identity boundary, Pet Profile, consent contracts, service events, veterinary clinical imaging ingestion, volume reconstruction, segmentation, clinical review, virtual surgical rehearsal, and GibiWorld spatial runtime delivery.

## Trust boundaries

1. Browser and client apps to public edge.
2. Public edge to API Management and identity verification.
3. API Management to service identity and server-owned memberships.
4. Service to Layer8 policy and entitlement decisions.
5. Ingestion gateway to quarantine sandbox and parser isolation.
6. Imaging service to owned PostgreSQL database and blob storage.
7. Service to Event backbone and outbox ledger.
8. Clinical Twin Asset Registry to GibiWorld Unity/XR client runtime.
9. Commercial VirtuaPet boundary to independent SugarDaddy.lgbt boundary.

## Priority threats and controls

| Threat | Impact | Required control | Phase 3 status & evidence |
|---|---|---|---|
| Forged identity or role | Cross-user or cross-clinic access | Verified OIDC; memberships resolved server-side | Tested: server-owned organization memberships and role verification |
| Direct object reference | Disclosure of another pet or study | Owner or consent grant check; non-disclosing not-found response | Tested: non-disclosing 404 on cross-guardian and unconsented requests |
| Overbroad consent | Location or health disclosure | Enumerated scopes, purpose, expiry, revocation | Tested: strict consent grant schema and revocation enforcement |
| Event replay or spoofing | Duplicate or false state | Signed service identity, idempotent consumer, outbox, event IDs | Tested: versioned envelope contract and outbox migration |
| Malicious DICOM or archive bomb | Code execution, parser crash, DOS | File size limits (<=100MB), PE/ELF/Mach-O magic byte detection, preamble verification, path traversal checks | Implemented & tested in \`inspectFileQuarantine\` |
| Heterogeneous slice mixing | Corrupted anatomy / incorrect spatial model | Strict multi-slice verification: identical PatientID, StudyUID, SeriesUID, Laterality, contiguous slice positions matching thickness within 0.05mm | Implemented & tested in \`validateDicomSeries\` |
| Wrong patient or laterality | Catastrophic surgical planning on wrong limb | 100% laterality and patient preservation; zero mismatch gate; verification against manifest | Implemented & tested in GATE-01 and GibiWorld delivery guard |
| Unapproved model entering rehearsal | Rehearsal of unverified anatomical geometry | Hard stop: only models with \`status="approved"\` signed by credentialed \`veterinarian\` can start rehearsal | Implemented & tested in rehearsal session endpoint |
| Unauthorized approval by staff | Violation of clinical governance | Only verified \`veterinarian\` role can approve; \`vet_staff\` cannot approve | Implemented & tested in model review endpoint |
| Tuberosity avulsion risk | Post-operative tibial fracture | Safe margin check: planned cut to tuberosity margin must be >= 10.0 mm | Implemented & tested in surgical plan endpoint |
| Forged GibiWorld asset or manifest | Tampered 3D model executed in XR headset | Cryptographic digital signature (HMAC/Ed25519) of manifest payload and GLB container hash | Implemented & tested in manifest verification |
| Expired or revoked entitlement | Unauthorized clinical twin usage | Time-bounded manifest expiration (24h) and active consent verification | Implemented & tested in rehearsal entitlement guard |
| Unsupported device scale distortion | Metric spatial inaccuracy in AR/VR | Strict physical scale factor (1.0 mm), coordinate system (\`glTF_Y_UP\`), and supported device profile whitelist | Implemented & tested in GibiWorld manifest gate |
| Hidden subgroup failure | Inaccurate planning in specific breed or scanner | Full holdout validation reporting stratified metrics across body size, scanner, protocol, and pathology | Implemented & tested in GATE-11 no-hidden-subgroup rule |

## Phase 3 Decision

The Phase 3 Clinical Twin Validation implementation establishes strict, test-verified defenses against malicious files, patient and laterality mismatches, unapproved rehearsal execution, and scale distortion. Production clinical deployment remains gated on live external veterinary approvals and real-world multi-site clinical evaluations.
