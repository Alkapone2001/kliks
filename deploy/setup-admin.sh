#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ "$EUID" -eq 0 ]] || { echo 'Run as the server administrator.' >&2; exit 2; }
environment=/etc/kliks-demo.env
[[ -f "$environment" ]] || { echo 'Run the demo bootstrap first.' >&2; exit 2; }
if grep -q '^DEMO_ADMIN_' "$environment"; then
  echo 'Administrator configuration already exists. Review it privately; no credentials were changed.'
  exit 2
fi
password="$(openssl rand -hex 24)"
token="$(openssl rand -hex 32)"
hash="$(printf '%s\n' "$password" | htpasswd -niB admin)"
hash="${hash#*:}"
temporary="$(mktemp /etc/kliks-demo.env.XXXXXX)"
trap 'rm -f "$temporary"' EXIT
cat "$environment" > "$temporary"
printf '\nDEMO_ADMIN_ENABLED=1\nDEMO_ADMIN_USER=admin\nDEMO_ADMIN_TOKEN=%s\nDEMO_ADMIN_PASSWORD_HASH=\x27%s\x27\n' "$token" "$hash" >> "$temporary"
printf 'username=admin\npassword=%s\n' "$password" > /root/kliks-admin-login.txt
chmod 600 "$temporary" /root/kliks-admin-login.txt
mv "$temporary" "$environment"
echo 'Administrator configuration created. Login is stored privately at /root/kliks-admin-login.txt. Deploy the reviewed release to activate it.'