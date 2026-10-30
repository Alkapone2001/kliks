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
1. **Foundation (complete):** pnpm/Turbo; NestJS, Next.js, Expo shells; PostgreSQL/Redis local services; Prisma package; strict TypeScript and lint/format; five API module boundaries; Money and Payment state model/tests; connector port and mock; audit foundation; health/OpenAPI; CI; architecture docs, ADRs, exact setup instructions. No authentication, real banking, QR, or merchant flows.
2. **Identity (complete):** persisted user IDs, normalized Kosovo phone numbers, canonical unique usernames, development-only verification, API endpoints, and privacy-aware responses/tests. No production SMS, authentication, public lookup, or bank connection.
3. **Mock bank connection (complete):** linked-account model and simulated authorization, safe display, default/disconnect/status, audit/tests. No real bank.
4. **Directory (complete):** phone/username resolution to safe previews, explicit privacy opt-in, generic misses, rate limiting, and recipient confirmation. Never expose phone or bank details.
5. **Core simulated payments (complete):** creation, payer/payee validation, money, persistent idempotency, simulated authorization/processing/outcomes, history, audit, database transactions, integration and concurrency tests. Still simulated.
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

## Phase completion contract

Report the completed phase, implemented work, test commands/results, architecture decisions, security notes, open risks, key files, run instructions, next recommended phase, and state that work stopped pending explicit approval. Current repository phase: **Phase 5, Core Simulated Payments complete**; Phase 6 requires explicit approval.

## Handoff log

Update this section at the end of each project work session or approved task. Record the date, current approved phase, what changed, verification results, known blockers/risks, and the next action requiring approval. Keep the product and architecture rules above stable unless an accepted ADR is explicitly superseded.

### 2026-10-29: Phase 1 foundation complete

- **Approved phase:** Phase 1, Foundation only. Phase 2 has not started.
- **Repository start:** empty Git repository; no prior source files or ADRs. This file now preserves the attached product and engineering context.
- **Implemented so far:** pnpm 12/Turbo monorepo; NestJS, Next.js, and Expo shells; shared packages; strict TypeScript, ESLint, and Prettier; local PostgreSQL/Redis Compose services; Prisma 7 config with intentionally empty schema; Money and Payment state model/tests; connector port and simulation-only Mock Bank; audit event types; `/health`; OpenAPI; CI; architecture docs and ADRs; setup guide.
- **Verified:** `pnpm install --frozen-lockfile`; `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test` (27 tests passed); `pnpm build` (API, Next static build, Android/iOS Expo bundles, Prisma 7 client generation); `docker compose config --quiet`; live `GET /health`; live `/docs-json` with `/health`; web shell HTTP 200.
- **Local preview:** web at `http://localhost:3000`; API at `http://localhost:3001`; API health at `/health`; Swagger UI at `/docs`. The API and web dev servers were started for preview.
- **Not run:** Docker containers were not started; GitHub Actions was not executed on a hosted runner. Compose configuration was validated locally.
- **Known constraints:** Prisma schema intentionally has no domain tables or migrations. There is no authentication, identity workflow, payment endpoint/workflow, real bank/provider, or money movement.
- **Next approval point:** Phase 1 is complete. Stop here and wait for explicit approval before Phase 2.

### 2026-10-29: UI polish follow-up

- **Phase scope:** Visual-only refinement of the existing Phase 1 web and mobile shells. No later-phase behavior was started.
- **Changed:** Applied a shared Space Grotesk brand system, clearer KLIKS identity, concept-only flow preview, explicit simulation notice, and concise foundation status rows. Fonts are bundled locally for web and native apps. The layout is responsive and respects reduced-motion preferences on web.
- **Safety:** No send controls, balances, account connection, real provider, or payment claims were added. The future flow is labeled concept-only; the current simulation warning remains prominent.
- **Verified:** `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test` (27 passed); `pnpm build` including Next static output and Android/iOS exports. Browser checks returned HTTP 200 and confirmed no horizontal overflow at 390px mobile and 1440px desktop widths; simulation notice was visible on mobile.
- **Next:** Phase 1 remains complete. Wait for explicit approval before starting Phase 2.

### 2026-10-29: Phase 2 identity complete

- **Approved phase:** Phase 2, Identity only. Phase 3 has not started.
- **Implemented:** persisted users with generated UUIDs, unique normalized Kosovo E.164 phone numbers, case-canonical unique ASCII usernames, verified status, hashed single-use expiring development challenges, Nest identity endpoints/DTO validation, safe public identity responses, and a fail-closed environment guard. Added Prisma PostgreSQL adapter/client, migration, and database-backed integration tests.
- **Privacy and safety:** no phone-number lookup endpoint; public responses never include phone numbers; no SMS is sent; development codes are returned only in explicit development mode and endpoints return 404 in production or when `NODE_ENV` is unset. No authentication or bank connection was added.
- **Database:** local KLIKS Postgres runs on host port 5433 to avoid the existing service on 5432. The Phase 2 migration is applied. The ignored `.env` predates the port change and could not be edited by the file tool; `.env.example` and README use 5433. Update local `.env` accordingly before using database commands in a new shell.
- **Verified:** `pnpm install --frozen-lockfile`; `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test` (37 API tests plus 8 shared tests); `pnpm build`; `pnpm db:deploy`; live development create/verification HTTP flow; live production guard returned 404; API health returned `{ status: "ok", service: "api" }`.
- **Local runtime:** API development preview is at `http://localhost:3001`; PostgreSQL is at `localhost:5433`. Docker services were used locally; GitHub Actions was not run on a hosted runner.
- **Known constraints:** no production SMS, authentication, public directory lookup, bank connection, or payment workflow.
- **Next approval point:** Phase 2 is complete. Stop and wait for explicit approval before Phase 3, Mock Bank Connection.

### 2026-10-29: Phase 3 Mock Bank Connection complete

- **Approved phase:** Phase 3 only. Phase 4, Directory, has not started.
- **Implemented:** persisted linked accounts with pending authorization, connected, rejected, and disconnected states; Mock Bank connect/approve/reject/disconnect adapter methods; development-only API routes to connect, authorize, list, set default, and disconnect; account operations require a verified development identity; default selection and disconnect state changes use database transactions.
- **Audit:** connection started/succeeded/failed/disconnected and default-changed events are persisted append-only in PostgreSQL in the same transactions as state changes. Audit metadata is limited to safe connector/status/simulation fields.
- **Privacy and safety:** every account response carries `simulation: true`; returns only generic `Mock Bank Demo Account` display data and never exposes provider references or real-looking account numbers. No real bank, credential collection, SMS, authentication, payment initiation, or money movement was added. The existing UI continues to visibly mark Mock Bank as simulated.
- **Verified:** Prisma generation and migration; `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test` (42 API tests plus 8 shared tests); `pnpm build`; live HTTP lifecycle pending -> connected -> default -> disconnected; API health and OpenAPI routes.
- **Local runtime:** API development preview at `http://localhost:3001`; PostgreSQL at `localhost:5433`. The synthetic HTTP test user and its audit records were removed. The local ignored `.env` may still need port 5433 as described above.
- **Known constraints:** no production authentication or real bank; user IDs are supplied by the development client and must not be used as authorization in a production context. All banking connection routes fail closed outside `development`/`test`.
- **Next approval point:** Phase 3 is complete. Stop and wait for explicit approval before Phase 4, Directory.

### 2026-10-30: Phase 4 Directory complete

- **Approved phase:** Phase 4 only. Phase 5, Core Simulated Payments, has not started.
- **Implemented:** opt-in directory visibility (default private), verified-phone requirement for enabling visibility, normalized Kosovo phone and canonical username resolution, safe recipient previews, generic misses for unknown/malformed/unlisted recipients, immediate opt-out, and transactional visibility audit events.
- **Enumeration/privacy controls:** resolution endpoints are development/test-only and limited to 30 requests per IP per minute using an in-process fixed-window guard. This is intentionally not a production/distributed abuse-control mechanism. No phone number, linked account, provider reference, or bank destination is returned.
- **Verified:** Prisma generation and migration; `pnpm install --frozen-lockfile`; `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test` (49 API tests plus 8 shared tests); `pnpm build`; `pnpm db:deploy`; live opt-in/phone/username/opt-out flow; live HTTP 429 after repeated lookup requests.
- **Local runtime:** API smoke-tested at `http://localhost:3003`; PostgreSQL at `localhost:5433`. Synthetic smoke identities and visibility audit rows were removed. The main preview API port 3001 is occupied by a stale listener; do not stop an unidentified process.
- **Known constraints:** no authentication exists yet, so Directory remains dev/test-only. The in-memory throttle resets on process restart and is unsuitable for production or multiple replicas.
- **Next approval point:** Phase 4 is complete. Stop and wait for explicit approval before Phase 5, Core Simulated Payments.

### 2026-10-30: Phase 5 Core Simulated Payments complete

- **Approved phase:** Phase 5 only. Phase 6, Mobile MVP, has not started.
- **Implemented:** persisted simulated payments with payer/payee IDs, connected default-account references, EUR minor-unit amount, state, provider reference, failure code, `simulation` marker, and payer-scoped persistent idempotency key plus SHA-256 request fingerprint. Added validated create, mock authorization, and participant-history endpoints.
- **Workflow:** creation validates verified payer, opted-in verified recipient, distinct identities, and connected default accounts. It stores `CREATED -> REQUIRES_AUTHORIZATION`; payer authorization simulates rejection, processing, success, insufficient funds, and generic provider failure through `BankConnector`.
- **Idempotency and audit:** exact retries return the existing payment; conflicting key reuse returns 409; a database uniqueness constraint and transaction cover concurrent retries. State changes and safe payment audit events are committed transactionally.
- **Privacy and safety:** payment routes are development/test-only. Responses omit linked-account IDs, provider references, idempotency keys, and phone numbers; all include `simulation: true`. No real money moves and no wallet balance is created.
- **Verified:** Prisma generation/migration; frozen install; formatting, lint, strict typecheck; `pnpm test` (60 API tests plus 8 shared tests); API/web/mobile/database build; migration deploy; live API payment create/idempotent retry/authorize/history smoke flow.
- **Database note:** local test environment must set `DATABASE_URL` to KLIKS Postgres on port 5433; the ignored `.env` may still point to the existing service on port 5432.
- **Known constraints:** no production authentication, provider, reconciliation, or mobile payment workflow. Payment endpoints remain dev/test-only.
- **Next approval point:** Phase 5 is complete. Stop and wait for explicit approval before Phase 6, Mobile MVP.
