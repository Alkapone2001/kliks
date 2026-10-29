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

### Intended interaction

Traditional flow: IBAN, bank selection, recipient form, amount, reference, confirmation. Intended KLIKS flow: verified phone/username/QR/link, amount, recipient confirmation, bank authorization, payment status. Payment requests and bill splitting are future product ideas, not Phase 1 capabilities.

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

## Domain responsibilities and data constraints

- **Identity:** internal user ID, normalized phone, username, verification/account status. Phone numbers are not primary IDs; consider recycling, changes, recovery, duplicate registration, SIM-swap, and device changes. Production SMS is not approved.
- **Directory:** resolve phone, username, or opaque QR/link reference to a safe recipient identity. Do not reveal whether arbitrary phone numbers are registered without privacy controls; never return private bank destination details.
- **Banking:** connector/provider authorization boundary, opaque linked-account references, initiation requests, and provider-status lookup. Never store online-banking credentials. Production token/account retention depends on authentic provider terms.
- **Payments:** generated internal payment ID; payer/payee IDs; linked-account/destination references; amount/currency; state; timestamps; provider reference; failure code; persistent idempotency key; audit events. Do not use public aliases as internal IDs or trust client claims of success, amount, destination, fees, or provider state.
- **Audit:** append-oriented event ID/type, actor/context where appropriate, entity ID, timestamp, and safe structured metadata. Exclude credentials, tokens, OTPs, sensitive authentication material, and unnecessary personal data.

The initial payment transitions are exactly: `CREATED -> REQUIRES_AUTHORIZATION` or `CANCELLED`; `REQUIRES_AUTHORIZATION -> PROCESSING`, `REJECTED`, or `CANCELLED`; `PROCESSING -> SUCCEEDED` or `FAILED`. `SUCCEEDED`, `REJECTED`, `FAILED`, and `CANCELLED` are terminal. Never reopen or rewrite a completed financial record; model any later correction explicitly.

All payment creation must eventually be idempotent in persistent storage. Same-identity/same-key retries must not create duplicates; test exact retries, concurrency, and key reuse with conflicting data. Redis is not the idempotency or payment source of truth.

Money uses non-negative integer minor units with mandatory currency (initially EUR). Validate supported currency and safe integer boundaries; never silently round, change currency, allow unintended negative values, or combine currencies. Serialize consistently and calculate authoritative values server-side.

QR codes and payment links are future work. They may contain opaque recipient/request/session references and optional proposed amounts, never credentials, access tokens, signing keys, or sensitive account data. Resolve them server-side and confirm recipient and amount before authorization.

## Banking boundary

Payments depend on a typed `BankConnector` abstraction, never directly on `MockBankConnector`. The mock is deterministic and visibly simulated. Do not name mock implementations after real banks. A real connector is forbidden until the external gate passes; the mock remains available for development and tests.

Never include credentials, access tokens, bank passwords, private signing keys, or sensitive account details in QR codes or links. QR/payment-link resolution must eventually be server-side and display recipient and amount before authorization.

## Roadmap and phase gate

Only one phase is authorized at a time. At each phase: inspect this plan, repository instructions, ADRs, and existing work; state the phase and concise plan; implement only that phase; run lint, typecheck, relevant tests, and build; fix introduced failures; update documentation and this handoff log; report; and stop. Never advance automatically. If a request conflicts with an accepted ADR, explain the conflict and propose a superseding ADR before changing the decision.

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

## Handoff log

Update this section at the end of each project work session or approved task. Record the date, current approved phase, what changed, verification results, known blockers/risks, and the next action requiring approval. Keep the product and architecture rules above stable unless an accepted ADR is explicitly superseded.

### 2026-10-29: Phase 1 foundation in progress

- **Approved phase:** Phase 1, Foundation only. Phase 2 has not started.
- **Repository start:** empty Git repository; no prior source files or ADRs. This file now preserves the attached product and engineering context.
- **Implemented so far:** pnpm 12/Turbo monorepo; NestJS, Next.js, and Expo shells; shared packages; strict TypeScript, ESLint, and Prettier; local PostgreSQL/Redis Compose services; Prisma 7 config with intentionally empty schema; Money and Payment state model/tests; connector port and simulation-only Mock Bank; audit event types; `/health`; OpenAPI; CI; architecture docs and ADRs; setup guide.
- **Verified so far:** dependency installation completed; formatting and lint passed before the final small config changes; strict typecheck passed; 27 unit tests passed; full build passed, including Prisma client generation, Next static build, and Android/iOS Expo bundle export.
- **Remaining before phase completion:** rerun formatting/lint after the latest edits; validate Docker Compose configuration; smoke-test the API `/health` and OpenAPI route if the environment permits; inspect final worktree and update this log with final results.
- **Known constraints:** no database domain models/migrations yet; no authentication, identity, payment endpoint/workflow, real bank/provider, or money movement. Docker daemon availability and live API smoke tests have not yet been confirmed.
- **Next approval point:** after Phase 1 completion report, wait for explicit approval before Phase 2.
