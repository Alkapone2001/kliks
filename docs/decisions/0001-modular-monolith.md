# ADR 0001: Modular Monolith

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

KLIKS needs clear ownership boundaries for identity, directory, banking, payments, and audit, but the product and its operating model are not yet validated.

## Decision

Start with one TypeScript monorepo and a NestJS modular-monolith API. Keep domain boundaries explicit in modules and packages. Do not introduce microservices.

## Reasoning

This gives the team separation of concerns and testable contracts without premature distributed-system operations and failure modes.

## Consequences

Modules can be extracted later if proven scale or ownership needs require it. Cross-module dependencies must remain explicit and narrow.

## Alternatives considered

Microservices were rejected because no independent deployment or scaling requirement has been demonstrated.
