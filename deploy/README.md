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

## Connect From Any Computer

| Detail                                  | Value                                                |
| --------------------------------------- | ---------------------------------------------------- |
| GitHub repository                       | `https://github.com/Alkapone2001/kliks.git`          |
| Live protected demo                     | `https://kliks.duckdns.org`                          |
| DigitalOcean IPv4                       | `165.232.64.119`                                     |
| SSH administrator                       | `root`                                               |
| SSH port                                | `22`                                                 |
| ED25519 host fingerprint                | `SHA256:8of9eYJ7cRWlKHF+aRE/fO2FEg4bsseuHdeDh56tQ0I` |
| Current release directory               | `/opt/kliks/current` (symlink)                       |
| Last healthy release SHA                | `/opt/kliks-release`                                 |
| Release directories                     | `/opt/kliks/releases/`                               |
| Server environment/DB secret/proxy hash | `/etc/kliks-demo.env` (root-only)                    |
| Website login recovery file             | `/root/kliks-demo-login.txt` (root-only)             |
| Restricted automation account           | `kliks-deploy` (not an interactive administrator)    |

For browser testing on another device, open the live demo and use the website login kept in your password manager. It is separate from the SSH administrator password. Saved application test identities are browser-local, so another browser/device may not show the same local identity selector; database records remain on the server.

For server administration from PowerShell, Terminal or another SSH client:

```bash
ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=10 root@165.232.64.119
```

Enter the administrator password directly when prompted. On first connection from a new machine, compare the displayed host fingerprint with the value above. If it differs, stop and verify the host through DigitalOcean's console; never disable host verification. After an intentional server rebuild/host-key rotation, update the documented fingerprint and GitHub `DEMO_KNOWN_HOSTS` only after independent verification.

If the administrator password is unavailable, use your password manager or DigitalOcean's authenticated console/recovery process. Do not copy passwords, private keys or tokens into the repository. A repository clone intentionally does not contain server access credentials or local `.env` files.

## Work From Another Computer

Normal code changes do not require SSH, the server password, the CI private key, Docker on the remote device, or reinstalling anything on the Droplet. Authenticate the new computer to GitHub with your own GitHub account and repository permissions. Server deployment credentials remain in the GitHub `demo` environment and continue working independently of your development computer.

```bash
git clone https://github.com/Alkapone2001/kliks.git
cd kliks
git switch main
git pull --ff-only origin main
git switch -c feature/your-change
```

Follow the root README for local dependencies and a new local-only `.env` if you want to run the app on that computer. Never copy the Droplet environment/database password into a developer machine's local `.env`.

After making and testing the change, commit the specific files and push your branch:

```bash
git add path/to/changed-file
git commit -m "Describe the change"
git push -u origin feature/your-change
```

Open a pull request targeting `main` and review CI. Feature branches and PRs do not deploy, so they cannot become live just by being pushed. Merge the reviewed PR into `main` when it is ready. That merge creates a `main` push: CI runs for the merge commit, and successful CI triggers automatic deployment. Direct pushes to `main` also follow this process, so use PRs for your intended branch workflow.

The live app updates after CI, image build, migrations and health checks succeed, not immediately on merge. Uncommitted/unpushed changes are never deployed. A failed gate does not promote a new current-release pointer; review failures before retrying. This is not a guarantee of zero downtime or automatic database rollback. Older CI completions are skipped if their SHA no longer matches current `main`, preventing a superseded build from overwriting a newer release. A newer `main` commit can remain pending while the last healthy release continues to serve.

## Check Which Commit Is Live

From GitHub, inspect [CI runs](https://github.com/Alkapone2001/kliks/actions/workflows/ci.yml) and [Deploy Protected Demo runs](https://github.com/Alkapone2001/kliks/actions/workflows/demo-deploy.yml). Both the correct commit's CI and its deployment should succeed; green PR CI alone does not mean the branch is live. A superseded deployment may finish successfully while explicitly skipping deployment.

After SSH login, these commands show the release and container status without printing credentials:

```bash
cat /opt/kliks-release
readlink -f /opt/kliks/current
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Compare the release SHA to the desired GitHub `main` commit. If deployment is still running, allow it to finish and inspect the Actions logs instead of manually editing live files. Application code edits on the server are not synchronized back to Git and will be replaced by future releases; make code changes in a branch and merge them instead.

Database contents, demo login, database credentials and TLS data are server state, not Git source. Releases preserve their Docker volumes and root-owned configuration. Commit required Prisma migrations with the code; changing an existing database password or destructive schema needs an explicit data/backup plan. Merely changing the environment password does not automatically rotate an existing PostgreSQL account password.

## Cross-Device Secrets and Recovery

- Keep the SSH administrator and website passwords in your password manager, not this runbook or Git history. Recover the website login through the root-only server file if necessary, without posting its contents publicly.
- Local credential-file copies and browser-cached logins can become stale after a password rotation. The root-only server login file is the recovery source; do not assume an old local copy is current.
- The dedicated CI private key is in GitHub's `demo` environment secret `DEMO_SSH_KEY`; GitHub does not provide plaintext recovery. A private operator key copy on the original development machine is not included in clones and is not needed for normal development or PR merges.
- If CI access must be rotated or the original machine is unavailable, generate a fresh dedicated deployment key in a trusted environment. Install only its public key for the restricted deployment account, then replace the environment secret through GitHub's secure settings/CLI. Do not replace it with the administrator password or grant that key an unrestricted root shell.
- Preserve the forced-command restriction and validated host pin when restoring automation. The root-owned receiver is `/usr/local/sbin/kliks-demo-receive`, with its narrow sudo rule under `/etc/sudoers.d/kliks-demo`.
- If you update receiver/bootstrap logic in Git, an administrator must review and explicitly install that changed privileged server component. An application release does not silently rewrite the trusted deployment receiver or rotate credentials.
- Keep DigitalOcean account recovery and DuckDNS account/domain control in the same secure operator handoff. The hostname currently points to this Droplet's public IP; replacing the Droplet requires reviewed DNS, SSH host-pin and deployment configuration updates.
- Enforce required PR reviews and the CI check in GitHub branch protection/rulesets if you want direct main pushes prohibited. This runbook does not claim branch protection was configured; automatic deployment alone does not enforce PR-only merges.

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

The Deploy Protected Demo workflow runs only after successful CI for a push to this repository's `main`, and skips completed builds superseded by a newer `main` SHA. It checks out the exact verified SHA, archives it without credentials, and sends it to the restricted receiver using strict host verification. Pull requests/forks cannot deploy through this workflow. Deployment is serialized in GitHub and on the server.

Each release is extracted separately, built, migrated and health-checked. `/opt/kliks/current` is updated only after the stack is healthy. This is not a zero-downtime or automatic database rollback guarantee; failed migrations/releases require operator review. Keep backups before destructive schema changes. Old releases/images must be pruned deliberately, not by deleting persistent database volumes.

## Verification

Verify unauthenticated HTTPS requests to both `/` and `/api/health` return 401, authenticated API health returns `ok`, the certificate matches the hostname, and ports 3000/3001/5432 are not publicly reachable. Never report deployment successful from a container build alone.

Use only synthetic identities and Mock Bank transactions. The shared demo login protects access to a prototype; it is not customer identity verification, tenant authorization, regulatory approval, or permission to expose real banking data.
