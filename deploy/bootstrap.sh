#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ "$EUID" -eq 0 ]] || exit 2
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 ca-certificates apache2-utils fail2ban sudo ufw
systemctl enable --now docker fail2ban
install -d -m 755 /opt/kliks/releases
if [[ ! -e /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi
if [[ ! -e /etc/kliks-demo.env ]]; then
  demo_password="$(openssl rand -hex 18)"
  database_password="$(openssl rand -hex 32)"
  password_hash="$(printf '%s\n' "$demo_password" | htpasswd -niB demo)"
  password_hash="${password_hash#*:}"
  printf 'DEMO_HOSTNAME=kliks.duckdns.org\nDEMO_USER=demo\nDB_PASSWORD=%s\nDEMO_PASSWORD_HASH=\x27%s\x27\n' "$database_password" "$password_hash" > /etc/kliks-demo.env
  printf 'username=demo\npassword=%s\n' "$demo_password" > /root/kliks-demo-login.txt
fi
if ! id kliks-deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash kliks-deploy
fi
install -m 755 deploy/receive.sh /usr/local/sbin/kliks-demo-receive
printf 'kliks-deploy ALL=(root) NOPASSWD: /usr/local/sbin/kliks-demo-receive *\n' > /etc/sudoers.d/kliks-demo
chmod 440 /etc/sudoers.d/kliks-demo
visudo -cf /etc/sudoers.d/kliks-demo >/dev/null
install -d -m 700 -o kliks-deploy -g kliks-deploy /home/kliks-deploy/.ssh
if [[ -f /root/kliks-demo-ci.pub ]]; then
  public_key="$(cat /root/kliks-demo-ci.pub)"
  printf 'restrict,command="sudo /usr/local/sbin/kliks-demo-receive \\"$SSH_ORIGINAL_COMMAND\\"" %s\n' "$public_key" > /home/kliks-deploy/.ssh/authorized_keys
  chown kliks-deploy:kliks-deploy /home/kliks-deploy/.ssh/authorized_keys
  chmod 600 /home/kliks-deploy/.ssh/authorized_keys
fi
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
echo 'Server prepared. Demo login is stored privately at /root/kliks-demo-login.txt.'