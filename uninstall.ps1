# pi-web uninstaller for Windows — removes binary, auto-start, and runtime
# state. Triggered as npm preuninstall hook when `pi remove npm:@ygncode/pi-web@beta`
# is run. The npm package directory itself is removed by npm after this script.
#
# Kept intact (survives uninstall — preserves data for reinstall):
#   - ~/.pi/agent/pi-web.sqlite          (settings, scratchpads, project prefs)
#   - ~/.pi/agent/pi-web-memory.sqlite   (memory skill data)
#   - ~/.config/pi-web/env               (PI_WEB_TOKEN, PATH, etc.)
#   - ~/.pi/agent/sessions/              (session files)

$ErrorActionPreference = 'Continue'

if ($env:PI_WEB_INSTALL_DIR) {
  $Binary = Join-Path $env:PI_WEB_INSTALL_DIR 'pi-web.exe'
} else {
  $Binary = Join-Path $HOME '.pi\agent\bin\pi-web.exe'
}
$ConfigDir = Join-Path $HOME '.config\pi-web'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'

function Info($msg) { Write-Host "-> $msg" }
function Skip($msg) { Write-Host "   (skipped) $msg" }

Write-Host ''
Info 'pi-web uninstaller (Windows)'
Write-Host ''

# Stop running instance
$proc = Get-Process -Name 'pi-web' -ErrorAction SilentlyContinue
if ($proc) {
  Info 'Stopping running pi-web instance...'
  $proc | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

# Remove binary (and any leftover from a previous swap)
if (Test-Path $Binary) {
  Info "Removing binary: $Binary"
  Remove-Item $Binary -Force -ErrorAction SilentlyContinue
} else {
  Skip "binary not found at $Binary"
}
Remove-Item "$Binary.old" -Force -ErrorAction SilentlyContinue

# Remove version file
$versionFile = Join-Path $HOME '.pi\agent\pi-web-version'
if (Test-Path $versionFile) {
  Info "Removing version file: $versionFile"
  Remove-Item $versionFile -Force
} else {
  Skip 'version file not found'
}

# Remove runtime state
$stateFile = Join-Path $HOME '.pi\agent\pi-web\pi-web-state.json'
if (Test-Path $stateFile) {
  Info "Removing state file: $stateFile"
  Remove-Item $stateFile -Force
} else {
  Skip 'state file not found'
}
$stateDir = Join-Path $HOME '.pi\agent\pi-web'
if ((Test-Path $stateDir) -and -not (Get-ChildItem $stateDir)) {
  Remove-Item $stateDir -Force
}

# Clean up stale npm temp dirs
$temps = @(Get-Item (Join-Path $HOME '.pi\agent\npm\node_modules\@ygncode\.pi-web-*') -ErrorAction SilentlyContinue)
foreach ($t in $temps) { Remove-Item $t.FullName -Recurse -Force -ErrorAction SilentlyContinue }
if ($temps.Count -gt 0) { Info "Cleaned up $($temps.Count) stale npm temp dir(s)" }

# Remove auto-start (Run key + hidden launcher; the env file is kept)
Remove-ItemProperty -Path $RunKey -Name 'pi-web' -ErrorAction SilentlyContinue
Remove-Item (Join-Path $ConfigDir 'pi-web-start.ps1') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $ConfigDir 'pi-web-start.vbs') -Force -ErrorAction SilentlyContinue
Info 'Removed Windows auto-start (Run key + launcher)'

Info 'pi-web service and binary removed.'
Info 'Data preserved: ~/.pi/agent/pi-web.sqlite, ~/.pi/agent/pi-web-memory.sqlite, ~/.config/pi-web/env'
Write-Host ''
