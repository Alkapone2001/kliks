# ADR 0004: Bank Connector Boundary

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

Payment orchestration must not become coupled to a provider implementation, and no genuine provider documentation or sandbox is available.

## Decision

Define a typed `BankConnector` port in the Banking domain. Payments depend on that port through an injection token. The only Phase 1 binding is `MockBankConnector`, whose results are visibly marked simulated.

## Reasoning

The boundary supports deterministic testing and a future provider implementation without pretending that one is approved or available.

## Consequences

Provider-specific behavior must remain behind the connector. Add real connector methods only from authentic requirements and after the external-dependency gate.

## Alternatives considered

Directly injecting a mock class into Payments was rejected because it couples the domain to an implementation. Inventing a real-bank adapter was rejected because no verified API exists.
