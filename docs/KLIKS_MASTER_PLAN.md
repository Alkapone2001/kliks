# KLIKS Master Product and Engineering Plan

This document preserves the product constraints, architecture, safety requirements, and phased roadmap for KLIKS. It is the durable project context; read it and the ADRs before substantial work. Implement only the currently approved phase, validate it, report completion, and stop for approval.

## Product

**Working name:** KLIKS  
**Consumer slogan:** "Veç kliko. U kry."  
**Product statement:** "Connect your bank. Pay anyone."

KLIKS is intended to simplify paying people and businesses in Kosovo by replacing manual bank-transfer details with verified usernames, phone numbers, QR codes, or payment links. The product hypothesis is an identity, recipient-discovery, payment-initiation, request, status, and merchant interaction layer, not a financial account.

### No-wallet model

KLIKS must not hold customer funds, create fictional balances, store online-banking credentials, claim to be a bank, invent a payment rail, or represent simulated activity as real. Any future payment must be authorized through the appropriate regulated bank/provider mechanism and move between customers' existing accounts. Always show and confirm the verified recipient and amount before authorization. Do not expose destination-account information through public search.

This operating model is not legally or technically approved. Do not present it as such.

### Unresolved external dependencies

Do not guess Kosovo regulatory or partner answers. Open questions include authorization and operating structure, bank/provider APIs, instant-payment participation, strong customer authentication, security certification, responsibility boundaries, alias-directory legality and privacy, identity/AML/fraud obligations, data retention, reversals/disputes, costs, and payment-status guarantees.

Before a real connector, create `docs/external-dependencies/` with: product flow; technical architecture and payment data flow; proposed KLIKS/partner responsibilities; security assumptions; exact CBK and institution questions; required API/sandbox capabilities; regulatory, legal, and operational risks; and an integration-readiness checklist. Real integration additionally requires an identified provider, authentic documentation and sandbox access, confirmed authorization and operating responsibilities, and understood authentication, status, error, and dispute semantics.

## Engineering principles

- Use a TypeScript monorepo with pnpm workspaces and Turborepo; NestJS REST/OpenAPI API; Next.js web; Expo React Native mobile; PostgreSQL with Prisma; Docker Compose locally; GitHub Actions CI.
- Start as a modular monolith. Do not add microservices, Kubernetes, Kafka, event sourcing, service mesh, distributed databases, multi-region infrastructure, custom cryptography, Redis jobs, or abstractions without a demonstrated requirement.
- Keep modules explicit: `identity`, `directory`, `banking`, `payments`, and `audit`. Add future modules only in their approved phases.
- PostgreSQL is the source of truth. Use Prisma migrations, relational constraints, and database transactions where required. Redis is never authoritative for payment state.
- Use integer minor units and mandatory currency for money. Never use floating point as authoritative money, silently round, change currency, or combine currencies. Validate boundaries and calculate authoritative values server-side.
- Use generated internal identifiers, not public phone numbers or usernames. Normalize phone numbers, protect lookup privacy, and account for number recycling and recovery risks when identity is implemented.
- Payment creation eventually requires persistent idempotency, concurrency protection, safe retries, and audit records. Never trust a client for amount, destination, provider status, or success.
- Use explicit payment state transitions. Initial states are `CREATED`, `REQUIRES_AUTHORIZATION`, `PROCESSING`, `SUCCEEDED`, `REJECTED`, `FAILED`, and `CANCELLED`. Completed records are not rewritten; corrections must be explicit.
- Do not log secrets, OTPs, tokens, credentials, or unnecessary personal data. `.env.example` contains placeholders/local-only values; never commit secrets. Do not use real financial or personal data in fixtures.
- Keep REST inputs validated, errors structured and safe, and OpenAPI current. Add authentication, KYC, fraud, compliance, and production controls only from confirmed requirements.

## Banking boundary

Payments depend on a typed `BankConnector` abstraction, never directly on `MockBankConnector`. The mock is deterministic and visibly simulated. Do not name mock implementations after real banks. A real connector is forbidden until the external gate passes; the mock remains available for development and tests.

Never include credentials, access tokens, bank passwords, private signing keys, or sensitive account details in QR codes or links. QR/payment-link resolution must eventually be server-side and display recipient and amount before authorization.

## Roadmap and phase gate

Only one phase is authorized at a time. At each phase: inspect existing work and ADRs, state the phase and concise plan, implement only that phase, run lint/typecheck/tests/build, fix introduced failures, update documentation, report, and stop. Never advance automatically.

0. **Repository context:** master plan, README, development rules, architecture docs, ADR directory.
1. **Foundation (current approved phase):** pnpm/Turbo; NestJS, Next.js, Expo shells; PostgreSQL/Redis local services; Prisma package; strict TypeScript and lint/format; five API module boundaries; Money and Payment state model/tests; connector port and mock; audit foundation; health/OpenAPI; CI; architecture docs, ADRs, exact setup instructions. No authentication, real banking, QR, or merchant flows.
2. **Identity:** user, normalized phone, unique username, development-only verification, endpoints/tests, privacy-aware lookup design. No production SMS or bank connection.
3. **Mock bank connection:** linked-account model and simulated authorization, safe display, default/disconnect/status, audit/tests. No real bank.
4. **Directory:** phone/username resolution, safe previews, enumeration resistance, privacy and recipient confirmation. Never expose bank details.
5. **Core simulated payments:** creation, payer/payee validation, money, persistent idempotency, simulated authorization/processing/outcomes, history, audit, database transactions, integration and concurrency tests. Still simulated.
6. **Mobile MVP:** development identity, home/send/review, mock authorization, result/history, visible simulation warning.
7. **Payment requests:** create/view/accept/reject/cancel/status and simulated payment, audit/tests.
8. **QR payments:** opaque safe payloads, generation/scanning, server resolution, recipient/amount confirmation, expiry/replay protection.
9. **Split bills:** participants, equal/custom amounts, consistency, requests/status/cancellation.
10. **Merchant foundation:** profiles/roles, merchant requests, static/dynamic QR concepts, history, justified refund placeholder, audit. Still simulated.
11. **External and regulatory gate:** prepare the complete external-dependency package and obtain genuine institutional information. Stop before real payments.
12. **Real provider connector:** only after provider, operating model, authorization, authentic API docs/sandbox, security, authentication, payment status, errors, and dispute behavior are confirmed.
13. **Reconciliation and operations:** implement from actual provider behavior, not assumptions.
14. **Production hardening:** threat model, authorization/security review, abuse/fraud/privacy, recovery, incident response, monitoring, and deployment based on the confirmed architecture.

Do not implement cards, cryptocurrency, international transfers, customer wallet balances, real money movement, production deployment, or unapproved future product features.

## Phase 1 completion contract

Report the completed phase, implemented work, test commands/results, architecture decisions, security notes, open risks, key files, run instructions, next recommended phase, and state that work stopped pending explicit approval. Current repository phase: **Phase 1, Foundation**.