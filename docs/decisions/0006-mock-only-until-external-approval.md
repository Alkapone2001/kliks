# ADR 0006: Mock Only Until External Approval

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

Production payment integration depends on unverified Kosovo legal, partner, API, authentication, security, and operational requirements.

## Decision

Use only a clearly labeled `MockBankConnector` until the external-dependency package is complete and the founder supplies authentic provider documentation, sandbox access, and confirmed responsibilities. Do not create fake connectors named after real institutions.

## Reasoning

Mock behavior enables local development without misrepresenting access to real financial infrastructure or guessing provider semantics.

## Consequences

All mock transactions remain explicitly simulated. A real connector requires a reviewed, superseding decision and must preserve the mock for tests.

## Alternatives considered

Invented provider APIs or bank-specific mocks were rejected because they would encode unverified assumptions.
