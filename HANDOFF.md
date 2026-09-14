# VirtuaPet Engineering Handoff

## Current state

The repository contains the Phase 1 development foundation. Shared contracts, a protected in-memory API, a responsive dashboard shell, tests, CI, architecture, threat model, and phased plan are present.

## Run and verify

1. Copy `.env.example` to `.env` and set a long local development token.
2. Run `npm install`.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Run `npm run build`.
6. Start the API and web development servers in separate terminals.

## Next implementation order

1. Verified Clerk or OIDC adapter with server-side organization membership.
2. PostgreSQL migrations, repositories, transaction boundaries, and row isolation.
3. Consent create, list, revoke, expiry, and authorization enforcement.
4. Transactional outbox and Azure Service Bus adapter.
5. Layer8 signed policy-decision integration.
6. Authenticated household dashboard with real empty states.
7. Azure development deployment and Hostinger preview release.

## Do not mistake for complete

The memory repository is local development storage. The user identity header is not production authentication. Capability cards are product-state labels, not active services. Clinical twins, FGS, regulation automation, robotics, fleet operations, drones, payments, PIMS, PACS, and production deployment remain unverified.

