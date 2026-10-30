#!/usr/bin/env bash
set -euo pipefail
requested="${1:-}"
[[ "$requested" =~ ^deploy\ ([0-9a-f]{40})$ ]] || exit 2
release="${BASH_REMATCH[1]}"
archive="$(mktemp /var/tmp/kliks-deploy.XXXXXX.tar.gz)"
trap 'rm -f "$archive"' EXIT
cat > "$archive"
tar -tzf "$archive" | awk '/(^\/|(^|\/)\.\.($|\/))/ { invalid=1 } END { exit invalid }'
destination="$(mktemp -d "/opt/kliks/releases/${release}.XXXXXX")"
tar --no-same-owner -xzf "$archive" -C "$destination"
bash "$destination/deploy/release.sh" "$release"