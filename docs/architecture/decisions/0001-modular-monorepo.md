# ADR 0001 Use a Modular Monorepo

## Status

Accepted for Phase 1.

## Decision

Store the first web application, API, and shared contracts in one npm workspace. Keep business modules separated by package and service boundaries so they may be extracted when scaling or regulatory isolation requires it.

## Consequences

Contract changes and application tests can run together. A monorepo does not authorize direct database sharing between services. Ownership boundaries remain architectural requirements.

