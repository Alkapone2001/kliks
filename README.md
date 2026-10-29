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

Web shell: `http://localhost:3000`

```powershell
pnpm --filter @kliks/mobile dev
```

Use the Expo terminal prompt to open the mobile shell in a compatible emulator or device. The root command `pnpm dev` starts all app development servers together.

### Development identity

Identity endpoints are available only when `NODE_ENV` is explicitly `development` or `test`; the API dev script sets `development`, and unset or production environments return 404. `POST /identity/users` creates an identity; `POST /identity/users/{id}/phone-verification` starts a simulated challenge and returns a development code; `POST /identity/users/{id}/phone-verification/confirm` confirms it. No SMS is sent. Responses never include the phone number, and there is no public phone-number lookup endpoint. Use synthetic data only.

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

- [Architecture overview](docs/architecture/README.md)
- [Master product and engineering plan](docs/KLIKS_MASTER_PLAN.md)
- [Architecture decision records](docs/decisions/README.md)

Phase 2, Identity, is complete. Do not start Phase 3 without explicit approval. Real bank/provider integration is prohibited until the external-dependency and regulatory gate described in the master plan is complete.
