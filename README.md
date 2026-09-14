# VirtuaPet

VirtuaPet is a shared pet-care platform for households, veterinary offices, caregivers, travel partners, and interactive 3D experiences. This repository starts with the safety and data foundation needed by every later product.

## Phase 1 status

Phase 1 foundation is implemented as a development baseline:

- canonical pet and consent contracts;
- protected pet-profile API with owner-bound access;
- health and readiness endpoints;
- capability registry with honest release labels;
- first responsive dashboard shell;
- architecture, threat model, phased plan, and decision records;
- automated contract and API tests.

This is not a production deployment, clinical device, autonomous robot, transport service, or regulatory advice system. Those capabilities remain gated in the development plan.

## Run locally

1. Install Node.js 22.12 or newer.
2. Copy `.env.example` to `.env` and replace the development token.
3. Run `npm install`.
4. Run `npm test`.
5. Run `npm run dev`.

The API starts at `http://127.0.0.1:8080`. Open `apps/web/index.html` for the dashboard shell.

## Repository map

- `apps/api` - Phase 1 HTTP API.
- `apps/web` - dashboard shell preserving the product-module layout.
- `packages/contracts` - shared schemas, permissions, events, and identifiers.
- `docs/architecture` - full target architecture and decision records.
- `docs/product` - phased development plan and acceptance evidence.
- `infra` - local dependency definitions and deployment guidance.

## Authoritative documents

- [Phased development plan](docs/product/PHASED_DEVELOPMENT_PLAN.md)
- [Full architecture specification](docs/architecture/VIRTUAPET_ARCHITECTURE_SPECIFICATION.md)
- [Phase 1 acceptance report](docs/product/PHASE_1_ACCEPTANCE.md)
- [Engineering handoff](HANDOFF.md)
