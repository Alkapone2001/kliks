# ADR 0002: Money in Minor Units

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

Payment amounts require exact arithmetic; JavaScript floating-point numbers cannot safely represent decimal currency values.

## Decision

Represent money as a non-negative safe integer number of minor units and an explicit currency. Phase 1 supports EUR and rejects unsupported currencies, invalid integers, mixed-currency arithmetic, and underflow.

## Reasoning

Integer arithmetic avoids binary floating-point rounding in authoritative money calculations and keeps currency explicit at domain boundaries.

## Consequences

Callers must convert display values at the boundary and must not silently round or change currency. Currency expansion requires deliberate validation and tests.

## Alternatives considered

Floating-point decimals were rejected. A decimal arithmetic dependency is not needed for the current integer-minor-unit model.
