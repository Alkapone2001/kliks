# KLIKS Architecture

## Product concept

KLIKS ("Veç kliko. U kry.") is a proposed payment interaction layer for Kosovo: users should eventually be able to identify a recipient by a verified username, phone number, QR code, or payment link instead of manually entering long bank details. KLIKS is not a wallet and does not hold customer funds. This is a product hypothesis, not a confirmed legal or operating model.

## Application shape

The system starts as a TypeScript modular monolith. NestJS modules establish domain boundaries inside one API; web and mobile clients remain separate applications. Microservices and distributed infrastructure are not justified at this stage.

## Domain boundaries

- **Identity** owns internal user identity, phone and username identity, verification state, and account status. It does not process payments.
- **Directory** resolves public aliases to safe KLIKS recipient identities. It must not reveal private destination-account data or enable unrestricted enumeration.
- **Banking** owns the `BankConnector` port, provider references, authorization boundary, initiation requests, and provider-status lookup.
- **Payments** owns payment records, amount and parties, allowed state transitions, idempotency, and orchestration through the connector abstraction. It must not depend on `MockBankConnector` directly.
- **Audit** defines append-oriented records for security- and payment-sensitive actions. Events must exclude credentials, OTPs, tokens, and unnecessary personal data.

Identity now persists internal IDs, normalized Kosovo phone numbers, canonical usernames, and phone-verification status. Its create/verification endpoints are hidden in production and return only safe identity previews. There is intentionally no public phone-number lookup endpoint; directory lookup belongs to its later approved phase. Authentication, production SMS, bank connection, and payment orchestration are not implemented.

## Money and payment safety

Money is represented as an integer number of minor units plus an explicit currency. JavaScript floating-point values are not authoritative. The initial supported currency is EUR; mixed-currency arithmetic and negative amounts are rejected.

Payment state is explicit. Only the transitions listed in the domain model are allowed; terminal states cannot be reopened. Client-supplied payment status, amount, destination, and provider outcome must never be trusted. Payment creation will require persistent idempotency once that workflow is introduced.

## No-wallet principle

KLIKS must not create a fictional customer balance, receive customer deposits, store online-banking credentials, or claim to be a bank. A future payment, if approved, must be authorized through the regulated bank or payment-provider mechanism and move between customers' existing accounts. No real money movement is implemented in this repository.

## Bank connector boundary

Payments depend on the typed `BankConnector` port, registered by a Nest injection token. Phase 1 binds that token to `MockBankConnector`. Every mock result explicitly identifies itself as simulated; the mock only returns deterministic pending/not-found outcomes. No real institution, provider, or production connector is represented.

Do not implement a real connector until authentic provider documentation and sandbox access, operating responsibilities, authorization requirements, security constraints, and payment-status semantics have been reviewed at the external-dependency gate (Phase 11).

## Data and local infrastructure

PostgreSQL is the source of truth; Prisma models identity and verification challenges in `packages/database`. Redis is available for local development only and is not an authoritative store for payment state. Docker ports bind to loopback and use development-only credentials.

## Simulation status

Mock Bank is a development/test connector, not financial infrastructure. Web and mobile shells visibly state that payment flows are disabled and no money moves. Do not remove that warning while the mock is active.

## External approval gate

Before any real bank/provider implementation, prepare the external-dependency package covering product and data flows, proposed operating responsibilities, security assumptions, exact CBK and institution questions, required API/sandbox capabilities, and unresolved legal and operational risks. Do not infer regulatory approval or invent provider behavior.
