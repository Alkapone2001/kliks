# ADR 0003: KLIKS Does Not Hold Customer Funds

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

The product aims to simplify payment initiation while users retain their existing bank accounts. The Kosovo regulatory and partner model has not been confirmed.

## Decision

KLIKS will not create customer balances, hold deposits, or present itself as a bank or wallet. Real payment flows remain prohibited until the required regulated operating model and partners are confirmed.

## Reasoning

This matches the current product hypothesis and avoids implying custody or regulatory approval that has not been established.

## Consequences

User interfaces must not imply that KLIKS stores funds or that simulated transactions move real money. Legal and partner assumptions remain open questions.

## Alternatives considered

A stored-value wallet was rejected as outside the intended product model and unsupported by regulatory analysis.