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

QR codes and payment links may contain opaque recipient/request/session references and optional proposed amounts, never credentials, access tokens, signing keys, or sensitive account data. Resolve them server-side and confirm recipient and amount before authorization. Phase 8 implements opaque, single-use QR session references; proposed amounts remain server-side. Public link hosting and universal-link deployment are not implemented.

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
6. **Mobile MVP (complete):** development identity, home/send/review, mock authorization, success/failure result, activity history, visible simulation warning.
7. **Payment requests (complete):** create/view/accept/reject/cancel/status and simulated payment, audit/tests; web/mobile request screens.
8. **QR payments (complete):** opaque safe payloads, local generation/browser/native scanning, server resolution, recipient/amount confirmation, 15-minute expiry and atomic replay protection.
9. **Split bills (complete):** participants including creator, exact equal/custom amounts, atomic linked requests, live status and race-safe cancellation; web/mobile workflows.
10. **Merchant foundation (complete):** profiles/owner-manager-viewer roles, attributed requests, static references/fresh checkouts and dynamic QR, safe history, disabled refund placeholder and audit; responsive web/native workflows. Still simulated.
11. **External and regulatory gate:** prepare the complete external-dependency package and obtain genuine institutional information. Stop before real payments.
12. **Real provider connector:** only after provider, operating model, authorization, authentic API docs/sandbox, security, authentication, payment status, errors, and dispute behavior are confirmed.
13. **Reconciliation and operations:** implement from actual provider behavior, not assumptions.
14. **Production hardening:** threat model, authorization/security review, abuse/fraud/privacy, recovery, incident response, monitoring, and deployment based on the confirmed architecture.

Do not implement cards, cryptocurrency, international transfers, customer wallet balances, real money movement, production deployment, or unapproved future product features.

## Phase completion contract

Report the completed phase, implemented work, test commands/results, architecture decisions, security notes, open risks, key files, run instructions, next recommended phase, and state that work stopped pending explicit approval. Current repository phase: **Phase 10, Merchant Foundation complete**; Phase 11 requires explicit approval and the external gate must be genuinely satisfied before real integration.

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

### 2026-10-30: GitHub Actions Prisma typecheck fix

- **Observed failure:** GitHub Actions run `41027640720` failed at Typecheck with `Cannot find module './generated/client/client.js'` from `packages/database/src/index.ts`; install, migrations, formatting, and lint passed.
- **Fix:** root dev/build/typecheck/test scripts now run `pnpm db:generate` before Turbo scheduling. `@kliks/database` build now compiles generated sources without rerunning Prisma generation concurrently with its typecheck.
- **Verified locally:** frozen install; database deploy; format, lint, strict typecheck; 60 API + 8 shared tests; full build all pass.
- **Remote status:** commit `3f2458f` completed GitHub Actions run `41031176464` successfully. Hosted install, migrations, formatting, lint, typecheck, tests, and build all passed.
- **Phase gate:** Phase 5 remains complete. Phase 6 has not started and requires explicit approval.

### 2026-10-30: Phase 6 Mobile MVP complete

- **Approved phase:** Phase 6 only. Phase 7, Payment Requests, has not started.
- **Implemented:** mobile development identity creation/verification, local development identity persistence, home screen with directory visibility and Mock Bank account management, recipient lookup by opted-in phone/username, EUR amount entry in integer minor units, review, simulated Mock Bank authorization/outcome, results, and participant activity history.
- **Safety:** every payment screen labels the flow simulated; no wallet balance or real payment is represented. Local storage contains only the development identity ID and username, not phone number, credentials, or account references. Payer directory opt-in is not required to pay; only the recipient must be discoverable.
- **API configuration:** iOS simulator defaults to `localhost:3001`; Android emulator defaults to `10.0.2.2:3001`. Physical devices can set `EXPO_PUBLIC_API_URL` to the reachable API host.
- **Verified:** Expo SDK check (`react-native@0.88.1`); `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test` (60 API tests plus 8 shared tests); `pnpm build` including Android and iOS Expo exports. A physical-device/emulator interaction session was not run.
- **Local preview:** API at `http://localhost:3001`; Expo Metro at `exp://192.168.1.7:8081`. Configure `EXPO_PUBLIC_API_URL` for physical devices as described in README.
- **Next approval point:** Phase 6 is complete. Stop and wait for explicit approval before Phase 7, Payment Requests.

### 2026-10-30: Personal iOS LAN preview

- **Deployment:** none; the phone connects directly to the development machine over the same Wi-Fi.
- **Current endpoints:** Expo Metro `exp://192.168.1.7:8082`; API `http://192.168.1.7:3006`; Postgres remains local on `localhost:5433`.
- **API base:** Expo started with `EXPO_PUBLIC_API_URL=http://192.168.1.7:3006` so the phone does not call its own localhost.
- **Verified:** API `/health` and Expo Metro `/status` returned HTTP 200 on the LAN address. The iPhone has not yet been confirmed connected; scan the Expo QR in Expo Go while on the same Wi-Fi.
- **Note:** LAN IP/ports may change. Recheck `Get-NetIPConfiguration` and allow Node/ports on the Windows private network if the phone cannot connect.

### 2026-10-30: Approved Phase 6 browser MVP companion

- **Approval:** user prioritized a usable browser MVP before Payment Requests. This extends the Phase 6 preview; Phase 7 remains unstarted and requires separate approval.
- **Implemented:** replaced the web placeholder with development identity creation/verification, saved local identity selection, explicit two-identity test setup, bank connection/authorization/rejection/default/disconnect, directory opt-in/out, recipient lookup, exact EUR input/review, simulated authorization/outcomes, results, resumable authorization, and participant activity.
- **Connection:** `http://localhost:3000` forwards `/api/*` to the API on port 3001 by default; `API_URL` overrides that server-side destination. No CORS or phone LAN setup is needed for PC testing.
- **Safety:** development sign-in is not production authentication. Every payment screen shows simulation status; no real bank, funds, credentials, or wallet balance. Local storage contains only identity IDs/usernames and the active ID. No new backend capabilities or future-phase features were introduced.
- **Verified:** web lint, strict typecheck, production build, and 12 focused amount/storage tests; browser interaction checks for manual verification, test-pair setup, all bank controls, successful/pending/insufficient-funds/provider-failure/rejected payments, recipient-side history, reload restoration, and lost-response creation retry with the same idempotency key and one persisted payment. Responsive checks at 1440/768/390/320 pixels found no horizontal overflow or broken icons.
- **Still unverified:** physical iPhone interaction and production authentication. iPhone LAN access was set aside at the user's request; it is not required for this browser preview.
- **Next gate:** stop before Phase 7 and wait for explicit approval.

### 2026-10-30: Phase 7 Payment Requests complete

- **Approval:** user explicitly authorized proceeding through completion of Phase 7 and requested phone-responsive web verification. No Phase 8 or later behavior is authorized.
- **Implemented:** persisted EUR requests with requester/payer identities, creation idempotency, safe participant-only list/detail, pending/accepted/rejected/cancelled lifecycle, live linked payment status, development-only endpoints/OpenAPI, append-only audit events, and browser/mobile request creation/review/incoming/outgoing/detail/action screens.
- **Atomicity:** PostgreSQL row locks serialize request decisions. Acceptance creates exactly one payment through PaymentsService in the same transaction as the unique link, request state, and audit records. Concurrent/repeated acceptance reuses that payment; acceptance is not payment authorization or success. Terminal decisions do not reopen. Failed acceptance leaves no orphaned payment or partial audit trail.
- **Safety:** verified/discoverable participants are required at creation; current payment eligibility is revalidated at acceptance. Both default accounts are required before acceptance, not before request creation. Only the payer accepts/rejects; only the requester cancels a pending request. IDs remain development-only actor claims, not production authorization. No sensitive bank/phone data is exposed, no real money moves, and no wallet balance is created.
- **Database:** additive migration `20261030115000_payment_requests` applied to local PostgreSQL on port 5433; generated and compiled client updated. SQL constraints enforce distinct parties, positive safe EUR amounts, and accepted/payment-link consistency.
- **Verified:** root tests (82 API including 22 request tests, 8 shared, 12 web); formatting, lint, strict typecheck, and full API/web/database/mobile build including iOS/Android exports. Request tests cover retries/conflicts, concurrent acceptance and accept/cancel races, participant restrictions, validation/privacy, guard registration, eligibility changes, payment outcomes, and rollback on audit failure. Browser checks cover creation/review, identity switch, acceptance/authorization/success, cancellation/rejection, reload/resume, and separate processing/success statuses.
- **Responsive web:** Requests page checked at 320/390/768/1440 pixels; five-item navigation, lists and icons fit without horizontal overflow. Phone-width screenshot inspected. This verifies browser layouts, not a physical iPhone session.
- **Runtime:** browser remains at `http://localhost:3000`; default API at `http://localhost:3001`; separate LAN API/Expo preview remains available but physical iPhone access is still unverified/deferred. Use README request testing steps; no deployment was performed.
- **Known limits:** no production authentication, request expiry, QR/payment links, splitting, merchant flows, real provider, or production deployment. Integration tests emit a PostgreSQL driver deprecation warning under concurrency, and Turbo reports missing test-output artifacts; neither failed the gates. Mobile interaction on a physical device/emulator was not performed.
- **Next gate:** Phase 7 is complete. Stop before Phase 8, QR payments, pending explicit approval.

### 2026-10-30: Phase 8 QR Payments complete

- **Approval:** user explicitly authorized Phase 8. No Phase 9 splitting or later behavior is authorized.
- **Implemented:** persisted single-use QR sessions with optional server-side EUR amounts, owner-scoped creation idempotency, 15-minute expiry, locally generated PNG images, owner list/detail/status, strict shared payload parsing, safe server resolution, separate recipient/amount confirmation, and atomic replay-safe payment creation through PaymentsService. QR payloads contain only an opaque versioned session UUID.
- **Clients:** responsive web QR generation/download, saved codes, ZXing camera and uploaded-image decoding, pasted payload fallback, review and payment handoff; Expo native generation/shareable payloads, CameraView QR scanning, permission-denial fallback, expiry-aware review and the same Mock Bank authorization flow. Leaving camera views releases them; iOS configuration includes the camera purpose and no microphone purpose, with Android audio recording disabled.
- **Atomicity/safety:** row locks serialize QR confirmation. Payment, consumption link and audit commit together; failures roll back. Scanning is read-only. Same-payer/same-amount retries recover one existing payment even after expiry; different-payer/amount replay is rejected. Expiry and recipient/account eligibility are rechecked on confirmation. Fixed amounts cannot be changed. Consumed codes never reopen. Responses and UI remain visibly simulated and development-only; no financial/private identity data or credentials are encoded.
- **Database/dependencies:** additive `20261030121000_qr_payments` migration applied to local PostgreSQL on port 5433; generated/compiled client updated. Uses `qrcode`, ZXing browser and SDK-compatible `expo-camera`, not custom encoders/decoders. QR image bytes stay local; no external QR-generation service is used.
- **Verified:** root tests (106 API including 24 QR tests, 20 shared including 12 payload tests, 12 web; 138 total), repository lint/typecheck/formatting and complete API/web/database/mobile build including iOS/Android exports. Tests cover privacy, amount binding, owner eligibility, expiry between scan/confirmation, concurrent payers, exact retries, replay rejection, separate authorization and transactional rollback.
- **Browser verification:** actual generated PNG uploaded and decoded, fixed/open amount review, successful authorization, payer rejection, used-code rejection, and simulated camera-denial fallback. Generator/scanner layouts fit at 320/390/768/1024/1440 pixels without horizontal overflow or broken images; phone-width screenshot inspected.
- **Build note:** Next.js reserves `app/icon.tsx` for metadata; the shared UI component is `app/ui-icon.tsx`. Production builds pass after that rename.
- **Runtime/limits:** web remains at `http://localhost:3000`, with QR pay navigation; no deployment. Actual camera hardware and physical iPhone interaction remain unverified. Browser cameras require localhost/HTTPS plus permission; the previous LAN firewall issue is still deferred. No production authentication, public universal links, split bills, merchants or real bank integration were introduced. Existing concurrency-driver/Turbo test-output warnings are non-failing.
- **Next gate:** stop before Phase 9, Split Bills, pending separate explicit approval.

### 2026-10-30: Phase 9 Split Bills complete

- **Approval:** user authorized the next phase after Phase 8, interpreted as Phase 9 only. Merchant Foundation and later phases remain unapproved.
- **Implemented:** persisted bills and immutable participant shares, equal/custom EUR allocation, creator-scoped idempotency/fingerprints, safe participant-only list/detail, atomic linked payment requests and audit, live request/payment status, creator cancellation, and responsive browser/native composition/review/detail/request workflows. Linked request details show the bill name.
- **Allocation:** 2 to 20 distinct verified/discoverable participants, creator included. The creator has a positive allocation without a self-payment request. Equal shares use integer/BigInt arithmetic and deterministic remainder cents in creator-first/displayed order. Custom shares must sum exactly; fractional, unsafe, zero, duplicate and inconsistent inputs are rejected. No client mark-paid operation or fictional balance exists.
- **Atomicity/cancellation:** bills, shares, all participant requests and audit records commit or roll back together. Bill cancellation locks the bill and request rows, cancels remaining pending requests atomically, and preserves terminal records. Any accepted request prevents cancellation. Acceptance-versus-cancellation races cannot create a cancelled bill with an accepted payment. Exact creation/cancellation retries do not duplicate or reopen records.
- **Status/safety:** settlement is derived from successful linked simulated payments, never acceptance or processing. Own share is not paid money. Responses exclude private phone/account/provider/idempotency data. All endpoints are guarded development/test-only; supplied actor IDs are not production authentication. No real funds, refunds, netting or merchant features were added.
- **Database:** additive `20261030124500_split_bills` migration applied to local PostgreSQL on port 5433; generated/compiled client updated. New bill enums are exported through the database package entry point for portable API declaration builds.
- **Verified:** root tests (127 API including 21 bill tests, 29 shared including 9 allocation tests, 12 web; 168 total), formatting, lint, strict typecheck and full build including Android/iOS exports. Tests cover exact shares, idempotency, privacy/validation, partial/full/pending/failed settlement, cancellation races, and creation/cancellation audit rollback. Existing request tests pass with caller-owned transactions.
- **Browser verification:** equal EUR 10.01 allocation into EUR 5.01 creator / EUR 5.00 participant, participant identity switch, linked bill context, request acceptance, Mock Bank success, derived settled status; custom mismatch rejection, exact custom creation and cancellation of the pending linked request. Bill list/detail/custom-entry layouts fit 320/390/768/1024/1440 pixels without horizontal overflow or broken icons; phone-width screenshot inspected.
- **Runtime/limits:** web remains at `http://localhost:3000` with Split bills navigation; native home has Split bills. No deployment. Physical-device interaction remains unverified and the earlier iPhone LAN/firewall issue stays deferred. Concurrency-driver/Turbo test-output warnings remain non-failing. Accepted bills cannot be cancelled or edited; no refund or financial record rewrite is implied.
- **Next gate:** stop before Phase 10, Merchant Foundation, pending separate explicit approval.

### 2026-10-30: Phase 10 Merchant Foundation complete

- **Approval:** user explicitly authorized Phase 10 only. External/regulatory preparation, real connectors, production authentication and deployment remain outside this task.
- **Implemented:** persisted one-profile-per-owner merchants, immutable owner authority, manager/viewer memberships, profile/team controls, attributed ordinary requests and fixed-amount dynamic QR, safe merchant-specific history, reusable static merchant references resolving to fresh 15-minute single-use open checkouts, and responsive browser/native merchant workspaces. Customer request/QR confirmation displays merchant name plus receiving identity.
- **Safety/roles:** server-side owner/manager/viewer checks, generic nonmember 404, restricted member 403, write locks serializing revocation, and audited staff changes/mutations. Merchant actions derive the owner's account recipient rather than accepting client destinations. Supplied actor IDs remain dev/test-only claims, not production authentication or legal business verification. No wallet, staff collection account, real bank, business verification, settlement guarantee or public deployment.
- **Atomicity/QR:** merchant request attribution, QR attribution and corresponding audit commit in the same transactions as existing request/session creation. Exact retries preserve existing records; failures roll back. Static QR contains only `kliks:merchant:v1:<opaque UUID>` and never initiates a payment itself. Temporary checkout confirmation retains expiry, amount binding, eligibility/default-account checks and single-use replay protection. Dynamic QR remains fixed-amount/single-use; authorization is separate.
- **Refund placeholder:** disabled in both clients with an explicit reason: simulations move no funds and authentic provider reversal/dispute rules are unknown. No refund endpoint, request, reversal transaction, balance adjustment or financial-record rewrite was implemented.
- **Database:** additive `20261030131000_merchant_foundation` migration applied to local PostgreSQL on port 5433; generated/compiled client and public role exports updated. No new external services or dependencies were required.
- **Verified:** root tests (144 API including 17 merchant tests, 34 shared including 5 new static-QR parser tests, 12 web; 190 total), repository formatting/lint/typecheck and complete API/web/database/mobile build including Android/iOS exports. Tests cover permissions/revocation, owner routing, private history, static/dynamic QR semantics, idempotency, audit actor/target data, cancellation attribution and rollback.
- **Browser verification:** merchant creation/profile editing; request review/customer acceptance/Mock Bank success/history; pending request cancellation; real static PNG decode, new checkout on rescan and successful payment; manager-generated dynamic PNG decode/fixed amount/customer rejection; viewer controls, promotion and access removal. Temporary test staff access was removed afterward. Merchant history/team/request/QR views fit 320/390/768/1024/1440 pixels without overflow or broken QR images; phone-width screenshot inspected.
- **Runtime/limits:** web remains at `http://localhost:3000` with Merchants navigation; native home has Merchants. The test shop is owned by the ready Alex identity. Physical-device/camera interaction remains unverified; the earlier iPhone LAN/firewall issue stays deferred. Existing concurrency-driver/Turbo test-output warnings are non-failing. No Phase 11 external-dependency package or real provider work was started.
- **Next gate:** stop before Phase 11, External and Regulatory Gate, pending separate explicit approval. Real integration additionally requires genuine provider/regulatory evidence, not just phase approval.
