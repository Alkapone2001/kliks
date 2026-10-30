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

Phase 6, Mobile MVP, is complete. Do not start Phase 7 without explicit approval. Real bank/provider integration is prohibited until the external-dependency and regulatory gate described in the master plan is complete.
