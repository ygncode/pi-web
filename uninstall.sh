#!/usr/bin/env bash
set -euo pipefail

# pi-web uninstaller — removes binary, service config, and runtime state.
# Triggered as npm preuninstall hook when `pi remove npm:@ygncode/pi-web@beta`
# is run. The npm package directory itself is removed by npm after this script.
#
# Kept intact (survives uninstall → preserves data for reinstall):
#   - ~/.pi/agent/pi-web.sqlite          (settings, scratchpads, project prefs)
#   - ~/.pi/agent/pi-web-memory.sqlite   (memory skill data)
#   - ~/.config/pi-web/env               (PI_WEB_TOKEN, PATH, etc.)
#   - ~/.pi/agent/sessions/              (session files)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}→${NC} $*" >&2; }
warn()  { echo -e "${YELLOW}⚠${NC} $*" >&2; }
skip()  { echo -e "  ${YELLOW}(skipped)${NC} $*" >&2; }

# Determine binary location (matches install.sh logic).
if [[ -n "${PI_WEB_INSTALL_DIR:-}" ]]; then
  BINARY="${PI_WEB_INSTALL_DIR}/pi-web"
elif [[ -n "${npm_package_name:-}" ]]; then
  BINARY="${HOME}/.pi/agent/bin/pi-web"
else
  BINARY="/usr/local/bin/pi-web"
fi

# ── Stop running instance ──────────────────────────────────────────
stop_service() {
  if [[ -f "$BINARY" ]]; then
    info "Stopping running pi-web instance..."
    if [[ "$(uname -s)" == "Linux" ]]; then
      systemctl --user stop pi-web.service 2>/dev/null || true
    elif [[ "$(uname -s)" == "Darwin" ]]; then
      launchctl bootout "gui/$(id -u)/com.pi-web" 2>/dev/null || launchctl unload "${HOME}/Library/LaunchAgents/com.pi-web.plist" 2>/dev/null || true
    fi
    pkill -f "${BINARY}" 2>/dev/null || true
    sleep 1
  fi
}

# ── Remove binary ──────────────────────────────────────────────────
remove_binary() {
  if [[ -f "$BINARY" ]]; then
    info "Removing binary: ${BINARY}"
    rm -f "$BINARY"
  else
    skip "binary not found at ${BINARY}"
  fi
}

# ── Remove version file ─────────────────────────────────────────────
remove_version_file() {
  local vf="${HOME}/.pi/agent/pi-web-version"
  if [[ -f "$vf" ]]; then
    info "Removing version file: ${vf}"
    rm -f "$vf"
  else
    skip "version file not found"
  fi
}

# ── Remove runtime state ────────────────────────────────────────────
remove_state() {
  local state="${HOME}/.pi/agent/pi-web/pi-web-state.json"
  if [[ -f "$state" ]]; then
    info "Removing state file: ${state}"
    rm -f "$state"
  else
    skip "state file not found"
  fi

  # Remove the parent dir if empty
  local parent_dir="${HOME}/.pi/agent/pi-web"
  if [[ -d "$parent_dir" ]]; then
    rmdir "$parent_dir" 2>/dev/null || true
  fi
}

# ── Clean up stale npm temp dirs ────────────────────────────────────
cleanup_npm_temps() {
  local pattern="${HOME}/.pi/agent/npm/node_modules/@ygncode/.pi-web-*"
  local count=0
  for d in $pattern; do
    if [[ -d "$d" ]]; then
      rm -rf "$d"
      count=$((count + 1))
    fi
  done
  if [[ $count -gt 0 ]]; then
    info "Cleaned up ${count} stale npm temp dir(s)"
  fi
}

# ── Remove macOS launchd plist ─────────────────────────────────────
remove_macos_plist() {
  local plist="${HOME}/Library/LaunchAgents/com.pi-web.plist"
  if [[ -f "$plist" ]]; then
    info "Removing launchd plist: ${plist}"
    rm -f "$plist"
  else
    skip "launchd plist not found"
  fi
}

# ── Remove Linux systemd service ────────────────────────────────────
remove_linux_service() {
  local service="${HOME}/.config/systemd/user/pi-web.service"
  if [[ -f "$service" ]]; then
    info "Removing systemd user service: ${service}"
    # Disable first (while the unit file still exists) to clear the
    # default.target.wants symlink that `systemctl --user enable` created;
    # removing the file alone would leave a dangling symlink.
    systemctl --user disable pi-web.service 2>/dev/null || true
    rm -f "$service"
    systemctl --user daemon-reload 2>/dev/null || true
  else
    skip "systemd service not found"
  fi
}

# ── Main ────────────────────────────────────────────────────────────
main() {
  echo ""
  info "pi-web uninstaller"
  echo ""

  stop_service
  remove_binary
  remove_version_file
  remove_state
  cleanup_npm_temps

  case "$(uname -s)" in
    Darwin) remove_macos_plist ;;
    Linux)  remove_linux_service ;;
  esac

  info "pi-web service and binary removed."
  info "Data preserved: ~/.pi/agent/pi-web.sqlite, ~/.pi/agent/pi-web-memory.sqlite, ~/.config/pi-web/env"
  echo ""
}

main
