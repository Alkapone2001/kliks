# KLIKS Architecture

## Product concept

KLIKS ("Veç kliko. U kry.") is a proposed payment interaction layer for Kosovo: users should eventually be able to identify a recipient by a verified username, phone number, QR code, or payment link instead of manually entering long bank details. KLIKS is not a wallet and does not hold customer funds. This is a product hypothesis, not a confirmed legal or operating model.

## Application shape

The system starts as a TypeScript modular monolith. NestJS modules establish domain boundaries inside one API; web and mobile clients remain separate applications. Microservices and distributed infrastructure are not justified at this stage.

## Domain boundaries

- **Identity** owns internal user identity, phone and username identity, verification state, and account status. It does not process payments.
- **Directory** resolves public aliases to safe KLIKS recipient identities. It must not reveal private destination-account data or enable unrestricted enumeration.
- **Banking** owns the `BankConnector` port, linked-account lifecycle, provider references, authorization boundary, initiation requests, and provider-status lookup.
- **Payments** owns payment records, amount and parties, allowed state transitions, idempotency, and orchestration through the connector abstraction. It must not depend on `MockBankConnector` directly.
- **Payment Requests** owns requests between verified development participants, creation idempotency, pending/accepted/rejected/cancelled decisions, and the unique link to a simulated payment. It delegates payment creation to Payments inside the same database transaction and does not authorize payments itself.
- **Audit** defines append-oriented records for security- and payment-sensitive actions. Events must exclude credentials, OTPs, tokens, and unnecessary personal data.

Identity persists internal IDs, normalized Kosovo phone numbers, canonical usernames, and phone-verification status. Its create/verification endpoints are hidden outside development/test and return only safe identity previews. There is intentionally no public phone-number lookup endpoint; directory lookup belongs to Phase 4.

Banking persists linked accounts with explicit pending, connected, rejected, and disconnected states. The development-only Mock Bank flow requires a verified development identity; authorization is simulated, safe account display data is returned, and users can choose a default or disconnect an account. There is no authentication or production bank connection.

Directory visibility is opt-in and defaults to private. Only phone-verified, explicitly listed identities can be resolved by normalized Kosovo phone number or canonical username. Phone and bank-account details are omitted; unknown, invalid, and unlisted queries share one not-found result. Lookup routes are development/test-only and rate-limited per IP in-process. Production access requires a reviewed authentication and abuse-control design.

## Money and payment safety

Money is represented as an integer number of minor units plus an explicit currency. JavaScript floating-point values are not authoritative. The initial supported currency is EUR; mixed-currency arithmetic and negative amounts are rejected.

Payment state is explicit and persisted. Only allowed transitions are applied; terminal states cannot be reopened. Payment creation validates safe integer minor units and EUR, resolves both parties and connected default accounts server-side, and enforces payer-scoped persistent idempotency with a request fingerprint. A changed request cannot reuse an existing key. Client-supplied payment status or provider reference is never trusted.

Payment requests use immutable participants and EUR amounts with requester-scoped persistent creation keys. Creating requires both participants to be verified and discoverable; acceptance revalidates the payment preconditions. Request decisions lock the PostgreSQL row so acceptance/rejection/cancellation cannot race into conflicting outcomes. Acceptance reuses a deterministic payment creation key and commits its unique payment link, request state, and both modules' audit records atomically. Failed acceptance rolls all of them back. The payer must then separately authorize the simulation. `ACCEPTED` is a request decision, not a financial success state; clients display the live linked payment state separately. This transaction strategy is for the deterministic mock, not a design approval for future real-provider side effects.

## No-wallet principle

KLIKS must not create a fictional customer balance, receive customer deposits, store online-banking credentials, or claim to be a bank. A future payment, if approved, must be authorized through the regulated bank or payment-provider mechanism and move between customers' existing accounts. No real money movement is implemented in this repository.

## Bank connector boundary

Payments depend on the typed `BankConnector` port, registered by a Nest injection token, never directly on `MockBankConnector`. The Banking module binds that token to the mock. Every result explicitly identifies itself as simulated. The mock supports deterministic account lifecycle plus payment authorization, processing, success, rejection, insufficient funds, generic failure, and status outcomes. No real institution, provider, or production connector is represented.

Do not implement a real connector until authentic provider documentation and sandbox access, operating responsibilities, authorization requirements, security constraints, and payment-status semantics have been reviewed at the external-dependency gate (Phase 11).

## Data and local infrastructure

PostgreSQL is the source of truth; Prisma models identity, verification challenges, directory opt-in, linked bank accounts, simulated payments, payment requests, and append-only audit events in `packages/database`. Directory visibility changes, request decisions, and payment state transitions are audited transactionally. Redis is available for local development only and is not an authoritative store for payment state or idempotency. Docker ports bind to loopback and use development-only credentials.

## Simulation status

Mock Bank is a development/test connector, not financial infrastructure. Web and mobile support simulated payments and requests and visibly state that no real money moves. Do not remove that warning while the mock is active.

The web and mobile MVPs connect development identity, directory opt-in, Mock Bank account linking, recipient/amount review, simulated authorization/outcomes, activity history, and payment requests. No phone number, credentials, verification code, or balance is persisted on-device. Every payment and request remains explicitly simulated. Browser layouts are responsive; physical-device interaction remains a separate verification step.

## External approval gate

Before any real bank/provider implementation, prepare the external-dependency package covering product and data flows, proposed operating responsibilities, security assumptions, exact CBK and institution questions, required API/sandbox capabilities, and unresolved legal and operational risks. Do not infer regulatory approval or invent provider behavior.
