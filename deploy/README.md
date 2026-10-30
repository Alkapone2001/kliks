# Protected Demo Hosting

This stack is authorized only as an access-protected, synthetic-data demo. It does not satisfy the external/regulatory gate or authorize real payments or production service.

## Active Demo

- Address: `https://kliks.duckdns.org` on the explicitly authorized DigitalOcean server.
- Separate website login is in `/root/kliks-demo-login.txt`. A private operator copy was retrieved outside the repository and opened locally; never paste it into chat or Git.
- First healthy automatically deployed application release: `f863c1b278f4b96fa4c574d3d383a04844cfa4bf`.
- CI run `41089932709` and automatic deployment run `41090206994` succeeded. Future pushes to `main` deploy only after successful CI.
- The actual Droplet has 2 GiB RAM; bootstrap added 2 GiB swap and image builds use bounded Node memory/serial tasks. This is a small demo, not a high-availability setup.
- Next.js rewrites embed the API destination at build time. Turbo's build environment must pass/hash `API_URL`; otherwise the web image incorrectly targets its own loopback address instead of `api:3001`.

Verified on the server with normal TLS validation: matching Let's Encrypt certificate, authenticated page HTTP 200, authenticated API health `ok`, anonymous page/API HTTP 401. External probes confirmed ports 3001 and 5432 were not reachable; container topology publishes only the proxy. The local Windows/tooling network returned TLS trust/revocation errors or 403, so direct iPhone Safari interaction remains an operator check; never bypass a browser certificate warning.

This explicitly approved protected-demo hosting task is separate from Phase 11 external/legal/provider approval. The evidence register remains BLOCKED, the mock remains the only connector, and only synthetic data is permitted.

- Caddy serves the controlled hostname over HTTPS and requires Basic authentication for the entire site, including `/api/*`.
- Only Caddy publishes ports 80/443. Web, API and PostgreSQL have no public host ports. Do not add bypass routes or expose the development API.
- The API runs compiled JavaScript with its development-only identity/mock endpoints enabled behind the authenticated proxy. This is intentionally not production authentication or a production banking API.
- Server-generated database/demo credentials live in root-readable `/etc/kliks-demo.env`; the separate website login is in `/root/kliks-demo-login.txt`. Do not commit or paste their contents into chat.
- The database and TLS data are persistent Docker volumes. Never use `docker compose down -v` on the demo unless intentionally deleting its synthetic data.

## Server Setup

The operator must verify SSH host identity, provide credentials directly to the terminal, and point `kliks.duckdns.org` to the controlled server. No SSH password is embedded in these files.

Run the bootstrap from a checked-out release directory as the administrator. It installs Docker/Compose and Fail2ban, adds swap if absent, creates separate demo credentials, permits SSH/HTTP/HTTPS in UFW, and configures a restricted deployment account from `/root/kliks-demo-ci.pub` when provided.

```bash
bash deploy/bootstrap.sh
bash deploy/release.sh VERIFIED_40_CHARACTER_COMMIT_SHA
```

The bootstrap does not rotate the operator's SSH password or disable their login. The CI key is separate and restricted to the deployment receiver. Treat access to that deployment key and repository main branch as privileged server-code execution. The deploy account has no normal shell through that key; its forced command accepts only an explicit 40-character release SHA and an archived source stream.

## Automatic Updates

Create a GitHub Actions environment named `demo` with:

| Setting            | Type                 | Value                                                                                 |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------- |
| `DEMO_SSH_KEY`     | Environment secret   | Dedicated private deployment key, supplied from a protected file without printing it. |
| `DEMO_KNOWN_HOSTS` | Environment variable | Server host-key line whose fingerprint was independently verified.                    |

The Deploy Protected Demo workflow runs only after successful CI for a push to this repository's `main`. It checks out that exact verified SHA, archives it without credentials, and sends it to the restricted receiver using strict host verification. Pull requests/forks cannot deploy through this workflow. Deployment is serialized in GitHub and on the server.

Each release is extracted separately, built, migrated and health-checked. `/opt/kliks/current` is updated only after the stack is healthy. This is not a zero-downtime or automatic database rollback guarantee; failed migrations/releases require operator review. Keep backups before destructive schema changes. Old releases/images must be pruned deliberately, not by deleting persistent database volumes.

## Verification

Verify unauthenticated HTTPS requests to both `/` and `/api/health` return 401, authenticated API health returns `ok`, the certificate matches the hostname, and ports 3000/3001/5432 are not publicly reachable. Never report deployment successful from a container build alone.

Use only synthetic identities and Mock Bank transactions. The shared demo login protects access to a prototype; it is not customer identity verification, tenant authorization, regulatory approval, or permission to expose real banking data.
