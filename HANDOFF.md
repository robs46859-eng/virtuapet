# VirtuaPet Engineering Handoff

## Current state

The repository contains the completed Phase 1 development foundation and the first Phase 2 pilot slice. It adds OIDC verification support, PostgreSQL persistence, consent revocation, permission-gated manual Feline Grimace Scale assessments, regulation evidence records, and an updated dashboard.

## Run and verify

1. Copy `.env.example` to `.env` and set a long local development token.
2. Run `npm install`.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Run `npm run build`.
6. Start the API and web development servers in separate terminals.

## Next implementation order

1. Map OIDC organization claims to server-owned clinic membership records rather than accepting provider claims as final authority.
2. Add PostgreSQL integration tests, row-level security, transactional outbox writes, migration ledger, and backup/restore evidence.
3. Add household invitations, clinic organizations, scheduling, communications, recall, and inventory pilot workflows.
4. Add human verification and supersession endpoints for regulation evidence.
5. Add Layer8 signed policy-decision and Azure Service Bus adapters.
6. Add authenticated dashboard workflows, accessibility tests, and design-partner telemetry.
7. Deploy an Azure development environment and Hostinger preview.

## Do not mistake for complete

The memory repository remains the automated-test default. The PostgreSQL migration and repository round trips passed against a temporary local PostgreSQL instance, but Azure PostgreSQL, backup, restore, concurrency, and row-level security remain unverified. OIDC code exists but no live provider has been configured. FGS is a manual workflow, not automated pain diagnosis. Regulation evidence does not yet automate jurisdiction resolution. Clinical twins, robotics, fleet operations, drones, payments, PIMS, PACS, and production deployment remain unverified.
