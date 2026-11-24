#!/usr/bin/env bash
set -euo pipefail
umask 077

assets="$(cd "$(dirname "$0")" && pwd)"
[[ "$EUID" == 0 ]] || { echo "Run as root." >&2; exit 1; }
ssh-keygen -l -f "$assets/deploy.pub" >/dev/null

id randevu-app >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin randevu-app
id randevu-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash randevu-deploy
install -d -m 755 /etc/randevu-platformu /usr/local/libexec
install -d -m 755 -o randevu-deploy -g randevu-deploy /opt/randevu-platformu /opt/randevu-platformu/releases
install -d -m 755 /home/randevu-deploy/.ssh
install -m 755 "$assets/release.sh" /usr/local/libexec/randevu-release
install -m 644 "$assets/randevu-platformu.service" /etc/systemd/system/randevu-platformu.service
printf 'restrict,command="/usr/local/libexec/randevu-release" %s\n' "$(cat "$assets/deploy.pub")" > /home/randevu-deploy/.ssh/authorized_keys
chmod 644 /home/randevu-deploy/.ssh/authorized_keys

rules="$(mktemp)"
trap 'rm -f "$rules"' EXIT
printf 'randevu-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart randevu-platformu.service, /usr/bin/systemctl stop randevu-platformu.service\n' > "$rules"
visudo -cf "$rules"
install -m 440 "$rules" /etc/sudoers.d/randevu-platformu

systemctl enable --now postgresql
if [[ ! -f /etc/randevu-platformu/runtime.env && ! -f /etc/randevu-platformu/migrate.env ]]; then
  app_password="$(openssl rand -hex 24)"
  migration_password="$(openssl rand -hex 24)"
  # Values are generated locally and only hexadecimal characters enter the SQL.
  runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -q postgres <<SQL
CREATE ROLE randevu_app LOGIN PASSWORD '$app_password';
CREATE ROLE randevu_migrate LOGIN PASSWORD '$migration_password';
CREATE DATABASE randevu OWNER randevu_migrate;
REVOKE ALL ON DATABASE randevu FROM PUBLIC;
GRANT CONNECT ON DATABASE randevu TO randevu_app;
SQL
  runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -q randevu -c 'CREATE EXTENSION btree_gist;'
  printf 'APPOINTMENT_DB_PORT=5432\nAPPOINTMENT_HTTPS=1\nAPPOINTMENT_DB_PASSWORD=%s\n' "$app_password" > /etc/randevu-platformu/runtime.env
  printf 'APPOINTMENT_MIGRATOR_PASSWORD=%s\n' "$migration_password" > /etc/randevu-platformu/migrate.env
  chgrp randevu-deploy /etc/randevu-platformu/migrate.env
  chmod 640 /etc/randevu-platformu/migrate.env
fi
test -f /etc/randevu-platformu/runtime.env
test -f /etc/randevu-platformu/migrate.env
systemctl daemon-reload
systemctl enable randevu-platformu.service
