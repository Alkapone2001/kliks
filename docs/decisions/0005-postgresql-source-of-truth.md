# ADR 0005: PostgreSQL Is the Source of Truth

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

Payment and audit records require durable, relational integrity. Local development also needs a repeatable database setup.

## Decision

Use PostgreSQL as the authoritative datastore and Prisma migrations for schema changes. Redis is not authoritative for payment state. Phase 1 configures Prisma but does not add domain tables before their approved phases.

## Reasoning

Relational constraints and transactions fit the planned payment and identity relationships; migrations keep database changes reviewable and repeatable.

## Consequences

Persistent payment operations must use database transactions and constraints where atomicity is required. Redis may only support justified ephemeral or background-work needs.

## Alternatives considered

Redis as a payment datastore was rejected because it is not the durable source of truth. Manual schema changes outside migrations are prohibited.