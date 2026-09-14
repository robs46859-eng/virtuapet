# ADR 0002 Keep the Pet Graph Small

## Status

Accepted for Phase 1.

## Decision

The canonical Pet Profile stores identity and linking information. Health, clinic, travel, device, commerce, imaging, and 3D services own their detailed records and expose authorized views through APIs and events.

## Consequences

The platform avoids a central unrestricted pet database. Cross-service workflows require explicit contracts, consent checks, and failure handling.

