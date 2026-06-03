#!/usr/bin/env bash
# Verifies install.sh's in-place self-update path: when PI_WEB_INPLACE_UPDATE is
# set, it must NOT stop/restart the service (doing so kills the npm process that
# spawned it — see internal/app/update.go), and must still swap the binary.
# Without the flag, the normal path must still stop the running instance.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_SH="$REPO_ROOT/install.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }

# Run install.sh in a sandboxed HOME with all external commands shimmed.
# $1: "inplace" or "normal".
run_case() {
  local mode="$1"
  local workdir bindir shimdir calllog
  workdir="$(mktemp -d)"
  bindir="$workdir/bin"
  shimdir="$workdir/shim"
  calllog="$workdir/calls.log"
  mkdir -p "$bindir" "$shimdir"

  # curl shim: serve the GitHub "latest release" JSON and a fake binary download.
  cat > "$shimdir/curl" <<'SHIM'
#!/usr/bin/env bash
out="" url=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[i]}" in
    -o) out="${args[i+1]}" ;;
    http*) url="${args[i]}" ;;
  esac
done
if [[ "$url" == *api.github.com* ]]; then
  echo '{"tag_name": "v9.9.9"}'
elif [[ "$url" == *releases/download* ]]; then
  printf '#!/bin/sh\necho v9.9.9\n' > "$out"
fi
exit 0
SHIM

  # Service managers / pkill / sudo: log the call so we can assert on it.
  local tool
  for tool in systemctl launchctl pkill sudo; do
    cat > "$shimdir/$tool" <<SHIM
#!/usr/bin/env bash
echo "$tool \$*" >> "$calllog"
[[ "$tool" == "sudo" ]] && exec "\$@"
exit 0
SHIM
  done
  chmod +x "$shimdir"/*
  : > "$calllog"

  # A stale binary so the "stop running instance" path is reachable in normal mode.
  printf '#!/bin/sh\necho v0.0.0\n' > "$bindir/pi-web"
  chmod +x "$bindir/pi-web"

  local env_vars=(
    "HOME=$workdir"
    "PI_WEB_INSTALL_DIR=$bindir"
    "PATH=$shimdir:/usr/bin:/bin"
  )
  [[ "$mode" == "inplace" ]] && env_vars+=("PI_WEB_INPLACE_UPDATE=1")

  env -i "${env_vars[@]}" bash "$INSTALL_SH" </dev/null > "$workdir/out.log" 2>&1 \
    || fail "[$mode] install.sh exited non-zero:"$'\n'"$(cat "$workdir/out.log")"

  [[ -x "$bindir/pi-web" ]] || fail "[$mode] binary missing after install"
  grep -q v9.9.9 "$bindir/pi-web" || fail "[$mode] binary not replaced with new version"

  if [[ "$mode" == "inplace" ]]; then
    [[ ! -s "$calllog" ]] \
      || fail "[inplace] expected no service/pkill calls, got:"$'\n'"$(cat "$calllog")"
  else
    grep -Eq 'systemctl|launchctl|pkill' "$calllog" \
      || fail "[normal] expected the running instance to be stopped, but nothing was called"
  fi

  echo "ok: $mode"
  rm -rf "$workdir"
}

run_case inplace
run_case normal
echo "PASS: install.sh in-place self-update"
