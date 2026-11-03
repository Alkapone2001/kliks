#!/usr/bin/env bash
set -euo pipefail
release="${1:?Commit SHA required}"
[[ "$release" =~ ^[0-9a-f]{40}$ ]] || exit 2
script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
release_directory="$(cd -- "$script_directory/.." && pwd -P)"
cd "$release_directory"
export RELEASE_SHA="$release"
compose=(docker compose --env-file /etc/kliks-demo.env -f deploy/compose.demo.yml)
exec 9>/var/lock/kliks-demo-deploy.lock
flock -n 9 || { echo 'Another deployment is running.'; exit 1; }
"${compose[@]}" config --quiet
"${compose[@]}" build api
"${compose[@]}" up -d --wait postgres
"${compose[@]}" --profile tools run --rm migrate
"${compose[@]}" up -d --wait --wait-timeout 240 api web caddy
ln -sfn "$release_directory" /opt/kliks/current
printf '%s\n' "$release" > /opt/kliks-release
echo "Demo release deployed: $release"