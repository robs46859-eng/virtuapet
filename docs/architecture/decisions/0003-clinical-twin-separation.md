# ADR 0003 Separate Clinical and Consumer Twins

## Status

Accepted as a target constraint.

## Decision

Clinical DICOM, segmentations, measurements, approvals, and derived rehearsal assets use a separate namespace, processing policy, entitlement model, encryption boundary, and retention schedule from consumer Pawsome3D assets.

## Consequences

GibiWorld may share rendering technology, but it receives only approved derivatives. Consumer pipelines cannot read clinical source material.

