#!/usr/bin/env bash
set -euo pipefail
umask 022

revision=${SSH_ORIGINAL_COMMAND:-}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Expected a Git commit SHA." >&2; exit 2; }
root=/opt/randevu-platformu
exec 9>"$root/.release.lock"
flock -w 180 9
releases="$root/releases"
release="$(mktemp -d "$releases/$revision-XXXXXX")"
chmod 755 "$release"
old="$(readlink -f "$root/current" || true)"
switched=0

activate() {
  local target="$1"
  local link="$root/.current-$$"
  ln -s "$target" "$link"
  mv -Tf "$link" "$root/current"
}

rollback() {
  local result=$?
  if (( result != 0 && switched == 1 )); then
    if [[ -d "$old" ]]; then
      activate "$old"
      sudo -n systemctl restart randevu-platformu.service
    else
      sudo -n systemctl stop randevu-platformu.service
    fi
  fi
}
trap rollback EXIT

curl --fail --silent --show-error --retry 3 --max-time 60 --proto '=https' \
  "https://codeload.github.com/selmancn/randevu-platformu/tar.gz/$revision" |
  tar -xz --strip-components=1 -C "$release"
cd "$release"
export NEXT_TELEMETRY_DISABLED=1
npm ci --no-audit --no-fund
npm run build
set -a
source /etc/randevu-platformu/migrate.env
set +a
node scripts/migrate-oracle.ts
unset APPOINTMENT_MIGRATOR_PASSWORD
printf '%s\n' "$revision" > .revision
activate "$release"
switched=1
sudo -n systemctl restart randevu-platformu.service
for _ in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:4312/api/health >/dev/null; then
    echo "Deployed $revision"
    exit 0
  fi
  sleep 1
done
echo 'Release failed health check.' >&2
exit 1
