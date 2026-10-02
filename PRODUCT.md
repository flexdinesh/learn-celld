# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User specified Docker, Node, pnpm monorepo, React/Vite, MinIO, and real celld.

## Users
Developer learning celld from a distributed systems perspective on their local machine.

## Product Purpose
Send real requests, inspect real state, and run small experiments to understand cells, ownership, durability, and failover.

## Operating Context
Local Docker Compose fleet of three celld nodes with one shared MinIO bucket; browser calls a Node API.

## Capabilities and Constraints
Named SQLite cells, concurrent increments, multiple independent cells, durable alarms, idle eviction, graceful stop and abrupt crash. Results must distinguish ingress from ownership. State observations are sampled, not a complete internal trace.

## Product Principles
- Make the mechanism observable.
- Every experiment runs against real services.
- Explain expected behavior alongside measured results.
- Preserve durable state across ordinary restarts.

## Open Decisions
Assumption pending optional UI question: guided experiments with live fleet map. No brand supplied. Code-first proposed; no standing build default recorded.

## Evidence on Hand
Official https://celld.dev/docs/ and celld v0.6.1 source. Live Docker state and MinIO records; no invented performance claims.
