# KLIKS

**Veç kliko. U kry.**

KLIKS is a proposed payment interaction layer for Kosovo: connect people to their existing bank accounts and make paying by a trusted identity simpler. KLIKS is not a wallet and does not hold customer funds. The legal and partner operating model is not yet confirmed, and this repository does not move real money.

> **Development simulation only.** The current Mock Bank connector never contacts a financial institution. No payment has been made by using this project.

## Prerequisites

- Node.js 22.13 or newer (Node 24 LTS or newer recommended).
- pnpm 12.16.1, installed below if it is not already available.
- Docker Desktop with the Docker Compose plugin, running for local PostgreSQL and Redis.
- An Android emulator/device or Expo Go-compatible device for mobile preview. iOS simulator builds require macOS.

Check the installed tools:

```powershell
node --version
pnpm --version
docker compose version
```

## Install

From the repository root in PowerShell:

```powershell
npm install --global pnpm@12.16.1
pnpm install
Copy-Item .env.example .env
```

`.env` contains local-only development credentials. Do not reuse them outside local development or commit `.env`.

## Local services

```powershell
docker compose up -d
docker compose ps
```

PostgreSQL binds to `127.0.0.1:5433` (to avoid the common local `5432` collision); Redis binds to `127.0.0.1:6379`. If you copied `.env` before this port was selected, set `POSTGRES_PORT=5433` and update `DATABASE_URL` to use port `5433`. To stop the containers without deleting local data:

```powershell
docker compose down
```

## Prisma

Generate the Prisma client and apply the current development migration:

```powershell
pnpm db:generate
pnpm db:migrate
```

`pnpm db:migrate` creates/applies local migrations; `pnpm db:deploy` applies committed migrations in CI. PostgreSQL remains the source of truth; Redis is not a payment datastore.

The root `pnpm dev`, `pnpm typecheck`, `pnpm test`, and `pnpm build` scripts generate the Prisma client before running Turbo tasks.

## Run applications

Run each application in its own terminal from the repository root:

```powershell
pnpm --filter @kliks/api dev
```

API health: `http://localhost:3001/health`  
OpenAPI documentation: `http://localhost:3001/docs`

```powershell
pnpm --filter @kliks/web dev
```

Browser MVP: `http://localhost:3000`. Keep the API running alongside it. Next.js forwards `/api/*` to `http://127.0.0.1:3001`; override the server-side `API_URL` before starting the web app if using another API port, for example `$env:API_URL='http://127.0.0.1:3006'`. Restart the web server after changing that setting. `http://localhost:3000/api/health` checks this connection.

### Test in the browser

1. Open `http://localhost:3000` and select **Create test pair**. This explicitly creates two synthetic, verified, discoverable identities with connected default Mock Bank accounts. Nothing is sent by SMS and no real bank is contacted.
2. Select **Send**, choose the other saved test identity, and enter a EUR amount. Review the resolved recipient and amount before continuing to Mock Bank.
3. Choose a simulated outcome: success, pending/processing, insufficient funds, or provider failure. Authorize or reject the simulation.
4. Open **Activity** to inspect the API's status and transaction reference. Switch the active identity to inspect the same transaction from the recipient's side. Activity rows reopen details or resume pending payer authorization.
5. **Bank accounts** supports connection, simulated authorization/rejection, default selection, and disconnection. **Overview** supports explicit directory opt-in/out; visibility is shown as unconfirmed after restoring a session because no directory-read endpoint exists.

Manual identity creation and development-code verification are also available. Use synthetic phone numbers only. Saved identity selection is a local development convenience, not secure login, account recovery, or production authentication. Browser storage contains identity IDs/usernames and the active identity ID only; it does not contain phone numbers, verification codes, bank references, or balances. Clearing browser storage removes this local identity selector, not the database records. Icons use versioned Lucide SVG assets from jsDelivr; API requests stay local.

Run the browser unit tests with `pnpm --filter @kliks/web test`; the root `pnpm test` also includes them.

### Test payment requests

1. Use the existing test pair, or verify two development identities and enable recipient discovery for both. Each needs a connected default Mock Bank account before acceptance, but accounts are not required merely to create a request.
2. Select **Requests**, then **New request**. Resolve the payer by username or phone, enter the EUR amount, review both parties and the amount, and create the request.
3. Switch to the payer identity. In **Requests / Incoming**, open the request and accept or reject it. Only the requester can cancel it, and only while it is pending.
4. Acceptance creates exactly one simulated payment awaiting authorization. Authorize it separately in Mock Bank, choosing any supported simulated outcome. After a reload, **Continue authorization** resumes the same payment.
5. Requests display their own status separately from their linked payment status. **ACCEPTED** does not mean paid; processing, success, failure, and payer rejection come from the payment record. Refresh to see the current API state.

The mobile home screen also exposes **Payment requests**, with incoming/outgoing lists, creation/review, participant actions, and the same Mock Bank authorization flow. The browser layout adapts to phone widths; responsive browser checks do not replace physical-device testing. The deferred Windows firewall issue still needs resolution before opening the LAN preview from an actual phone.

### Mobile preview

```powershell
pnpm --filter @kliks/mobile dev
```

Use the Expo terminal prompt to open the mobile shell in a compatible emulator or device. The root command `pnpm dev` starts all app development servers together.

The mobile app defaults to `http://localhost:3001` on iOS simulators and `http://10.0.2.2:3001` on Android emulators. For a physical device, set `EXPO_PUBLIC_API_URL` to the API host's LAN address before starting Expo, for example `$env:EXPO_PUBLIC_API_URL='http://192.168.1.20:3001'` in PowerShell. Ensure the API port is reachable from the device.

### Development identity

Identity endpoints are available only when `NODE_ENV` is explicitly `development` or `test`; the API dev script sets `development`, and unset or production environments return 404. `POST /identity/users` creates an identity; `POST /identity/users/{id}/phone-verification` starts a simulated challenge and returns a development code; `POST /identity/users/{id}/phone-verification/confirm` confirms it. No SMS is sent. Responses never include the phone number, and there is no public phone-number lookup endpoint. Use synthetic data only.

### Mock Bank connection

Mock Bank account endpoints use the same development/test-only guard and require a verified development identity. `POST /banking/accounts` starts a pending simulated connection with `{ "userId": "<uuid>" }`. `POST /banking/accounts/{id}/authorize` takes `userId` and `decision` (`APPROVE` or `REJECT`). `GET /banking/accounts?userId=<uuid>` returns safe display/status information only. `POST /banking/accounts/{id}/default` and `POST /banking/accounts/{id}/disconnect` take `userId`. Every response is marked `simulation: true`; provider references are never returned. No real bank is contacted.

### Development directory

Directory routes are development/test-only until authentication exists. New identities are private by default. `POST /directory/visibility` takes `{ "userId": "<uuid>", "enabled": true }`; enabling requires verified phone status and opt-out is immediate. `POST /directory/resolve/phone` takes `{ "phoneNumber": "044..." }`; `POST /directory/resolve/username` takes `{ "username": "..." }`. Successful responses include only the internal recipient ID, canonical username, verified status, and creation time. Unknown, malformed, or unlisted recipients all return the same 404. Phone numbers and linked-bank details are never returned. Directory requests are limited to 30 per IP per minute in the current API process; this in-memory guard is development-only, not a production/distributed abuse control.

### Simulated payments

Payment routes are development/test-only. `POST /payments` takes verified internal `payerId` and opted-in `payeeId`, positive `amountMinor`, `currency` (`EUR`), and a payer-scoped `idempotencyKey`. The payer and recipient must each have a connected default Mock Bank account. Exact retries return the original payment; reusing the key with different request data returns `409`. `POST /payments/{id}/authorize` takes `payerId`, `decision` (`APPROVE` or `REJECT`), and optional mock `outcome` (`SUCCESS`, `PENDING`, `INSUFFICIENT_FUNDS`, `PROVIDER_FAILURE`). `GET /payments?userId=<uuid>` returns participant history. Every result is marked `simulation: true`; no real funds move and bank references are omitted.

The mobile MVP connects these APIs: development identity and simulated verification, recipient selection by opted-in phone/username, EUR amount and review, Mock Bank authorization, simulated result, and activity history. It stores only the development identity ID and username locally. It does not store a phone number, credentials, or balance.

### Payment request API

All `/payment-requests` endpoints are development/test-only and return `simulation: true`. `POST /payment-requests` takes `requesterId`, `payerId`, positive safe-integer `amountMinor`, `currency: "EUR"`, and a requester-scoped `idempotencyKey`. Both identities must be verified and discoverable. Exact creation retries return the existing request, including after a terminal decision; conflicting reuse returns 409. Self-requests are rejected.

`GET /payment-requests?userId=<uuid>` lists only that participant's requests. `GET /payment-requests/{id}?userId=<uuid>` returns participant details, safe aliases, request state and live linked payment status, never phone numbers, account/provider references, or idempotency keys. Nonparticipants receive a generic 404. Caller-supplied identity IDs are a development convenience, not production authentication or authorization.

`POST /payment-requests/{id}/accept`, `/reject`, and `/cancel` take `{ "userId": "<uuid>" }`. Only the payer can accept/reject, and only the requester can cancel. Acceptance row-locks the request and atomically persists the payment, link, accepted state, and audit events. Concurrent/repeated acceptance reuses one payment; rejected/cancelled requests cannot be reopened, and accepted requests cannot be cancelled. Same-decision retries are idempotent. Current participant verification, payee visibility, and both default accounts are rechecked before payment creation. Payment authorization stays on `/payments/{id}/authorize` and is never implicit in acceptance. Phase 7 adds no expiry, QR/link, split-bill, merchant, real-bank, or production-authentication behavior.

### Test QR payments

1. Open `http://localhost:3000` and select **QR pay / My codes**. The receiving identity must be verified and opted in to recipient discovery. Enter an optional EUR amount and select **Generate QR**. With no proposed amount, the payer chooses the amount later.
2. Download the PNG or copy the selectable QR payload. Switch to a different development identity and open **QR pay / Scan / pay**. Upload that PNG, paste the payload and select **Resolve QR**, or start the camera. Browser camera access requires `localhost` or HTTPS and permission; uploading/pasting works without a camera.
3. Check the server-resolved recipient and amount. Fixed proposed amounts cannot be changed. Select **Review QR payment**, then **Continue to Mock Bank**, and separately authorize or reject the simulation.
4. Each QR expires after 15 minutes and is single-use. Resolving/scanning does not consume it; confirmation atomically creates one payment and consumes it. Rejection/failure does not reopen the code: generate another code for a new attempt. Exact retries by the same payer/amount recover the existing payment, including after expiry; different-payer or changed-amount replay cannot create another payment.
5. **My codes** shows available, expired, used, or unavailable status. Loss of recipient verification/discovery makes an unused code unavailable. Both participants need connected default Mock Bank accounts at payment confirmation. No QR code encodes phone numbers, usernames, amounts, bank references, credentials, or access tokens.

Mobile home exposes **QR payments** with generation, selectable/shareable payloads, native QR camera scanning, pasted-payload fallback, and the same recipient/amount confirmation and Mock Bank authorization. Camera access is requested only when starting the scanner; microphone/audio recording is disabled. Payment QR codes are not Expo launch QR codes: open KLIKS first and use its scanner. No universal-link/app-link hosting or public deployment is configured.

### QR payment API

All `/qr-payments` endpoints are development/test-only and results are marked `simulation: true`. `POST /qr-payments` takes verified/discoverable `ownerId`, `currency: "EUR"`, an owner-scoped `idempotencyKey`, and optional positive safe-integer `amountMinor`. It returns an opaque `kliks:pay:v1:<session-uuid>` payload, locally encoded PNG data URL, expiry and status. Exact creation retries recover the same session; conflicting key reuse returns 409. `GET /qr-payments?userId=<owner>` lists the most recent 50 codes, and `GET /qr-payments/{id}?userId=<owner>` returns that owner's QR image.

`POST /qr-payments/resolve` takes `{ "payerId": "<uuid>", "payload": "kliks:pay:v1:<opaque-uuid>" }`. It returns a safe verified recipient, optional proposed amount, currency and expiry without consuming the session. Unknown, unsupported, expired, consumed and hidden-recipient codes return a generic not-found response. Self-payment and unverified payer attempts are rejected. Arbitrary URLs or extra payload fields are not followed or trusted.

`POST /qr-payments/pay` takes the same fields plus the confirmed positive integer `amountMinor`; it accepts no client destination/currency. A row lock serializes confirmation. The service revalidates expiry, recipient discovery/verification, proposed amount and existing payment/account rules, then atomically persists the payment, consumption link and audit records. Lost-response retries return the same payer's same-amount payment; other replays are rejected. Authorization remains a separate `/payments/{id}/authorize` action. This is a deterministic mock flow, not production authentication, real payment infrastructure or authorization to deploy publicly.

### Test split bills

1. Use two or more verified, discoverable development identities. The existing ready test pair is sufficient. Open **Split bills / New bill**, enter a bill name and positive EUR total, and add participants by username or phone. The creator is included automatically; up to 20 participants are supported.
2. Choose **Equal shares** or **Custom amounts**. Equal splitting uses integer minor units: leftover cents go to the creator first, then other participants in the displayed order. Each share must be at least one cent. Custom amounts must be positive and sum exactly to the total; inconsistent totals are blocked without creating requests.
3. Review all shares and select **Create bill and requests**. The creator's own share is recorded without a self-payment request. Every other participant gets one ordinary simulated payment request, all committed atomically with the bill.
4. Switch to a participant, open the shared bill, and select **Open request** on their share. Request details include the bill name. Accept/reject and Mock Bank authorization use the existing request flow. Both sides need connected default Mock Bank accounts before a payment can be initiated; merely creating the bill does not require accounts.
5. Refresh the bill to see live request/payment status. Acceptance and processing do not count as settlement. **Simulated settled** sums successful requested shares only; the creator's own share is not a payment or wallet balance. A bill becomes settled only when all non-creator payments succeed. Failed/rejected/cancelled shares stay visible and are not rewritten.
6. Only the creator can **Cancel bill**, and only before any share request is accepted. Cancellation atomically cancels all remaining pending requests and preserves already rejected/cancelled records. Once any share is accepted, the bill cannot be cancelled, even if the linked payment later fails or is rejected. This does not undo payments or implement refunds.

The mobile home screen exposes the same **Split bills** creation/review/detail/request/cancellation workflow. Web bill list, detail and custom-entry layouts adapt to phone widths. Browser automation and native exports do not constitute a physical-device interaction test.

### Split bill API

All `/split-bills` endpoints are development/test-only and responses include `simulation: true`. `POST /split-bills` accepts `creatorId`, a nonblank `title` up to 80 characters, positive safe-integer `totalMinor`, `currency: "EUR"`, `mode: "EQUAL" | "CUSTOM"`, an owner-scoped `idempotencyKey`, and `participants: [{ "userId": "<uuid>", "amountMinor": 123 }]`. Include the creator exactly once. Omit participant amounts in equal mode; provide every amount in custom mode. Participants must be distinct, verified and discoverable. Server-side allocation and current participant checks remain authoritative.

Creation retries with the same key/content return the existing bill, including after cancellation; changed content returns 409. Bills, immutable shares, linked requests and audit records commit together. `GET /split-bills?userId=<uuid>` lists only that participant's bills; `GET /split-bills/{id}?userId=<uuid>` returns safe participant aliases, exact shares and live linked request/payment states, never phone/account/provider details or idempotency fingerprints. Nonparticipants receive a generic 404. Caller IDs are development actor claims, not production authentication.

`POST /split-bills/{id}/cancel` accepts `{ "userId": "<creator-uuid>" }`. Bill/request row locks serialize cancellation against share acceptance. A repeated cancellation is idempotent; accepted requests prevent cancellation. A race cannot leave a cancelled bill with a newly accepted share. Bill statuses are `OPEN`, `IN_PROGRESS`, `PARTIALLY_SETTLED`, `SETTLED`, `NEEDS_ATTENTION`, or `CANCELLED`, derived from persisted bill state and live linked payment/request records. There is no client-controlled mark-paid operation, automatic settlement, self-payment, debt netting, balance, refund or real money movement.

## Quality checks

Run from the repository root:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format` applies the configured Prettier formatting. The build exports the mobile shell for local preview; it is not a production release process.

## Architecture and scope

Phase 9, Split Bills, is complete with responsive browser and native workflows. Phase 10, Merchant Foundation, requires separate explicit approval. Real bank/provider integration remains prohibited until the external-dependency and regulatory gate described in the master plan is complete.
