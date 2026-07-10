# pi-web installer for Windows — downloads the binary and sets up auto-start.
#
# Standalone (no pi required):
#   irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
#
# Via pi package (also registers /web, /remote commands):
#   pi install npm:@ygncode/pi-web@beta
#
# Updates are handled by re-running the same command.
#
# Auto-start model (the Windows counterpart of install.sh's launchd/systemd
# setup, kept admin-free): a HKCU Run-key entry launches pi-web-start.vbs at
# login, which runs pi-web-start.ps1 without a console window; the .ps1 loads
# ~/.config/pi-web/env (PI_WEB_TOKEN, PATH, ...) and starts the binary hidden.
# Requires the pi CLI plus a bash for pi's shell tool (Git Bash is enough —
# see pi's docs/windows.md).

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'ygncode/pi-web'
if ($env:PI_WEB_INSTALL_DIR) {
  $InstallDir = $env:PI_WEB_INSTALL_DIR
} else {
  # No sudo-writable /usr/local/bin equivalent on Windows; the pi agent bin
  # dir works for both npm-lifecycle and standalone installs without elevation.
  $InstallDir = Join-Path $HOME '.pi\agent\bin'
}
$Binary = Join-Path $InstallDir 'pi-web.exe'
$VersionFile = Join-Path $HOME '.pi\agent\pi-web-version'
$ConfigDir = Join-Path $HOME '.config\pi-web'
$EnvFile = Join-Path $ConfigDir 'env'
$LauncherPs1 = Join-Path $ConfigDir 'pi-web-start.ps1'
$LauncherVbs = Join-Path $ConfigDir 'pi-web-start.vbs'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'

function Info($msg) { Write-Host "-> $msg" }
function Warn($msg) { Write-Host "!  $msg" -ForegroundColor Yellow }

function Get-Arch {
  $arch = "$env:PROCESSOR_ARCHITECTURE"
  # An x64 PowerShell on ARM64 reports AMD64; prefer the OS architecture.
  try { $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() } catch {}
  switch -Regex ($arch) {
    '^(ARM64|Arm64)$' { return 'arm64' }
    '^(AMD64|X64|x64)$' { return 'amd64' }
    default { throw "Unsupported architecture: $arch" }
  }
}

function Get-PackageTag {
  # When running as an npm lifecycle script, install the binary that matches
  # the npm package version so pinned installs stay pinned (see install.sh).
  if ($env:npm_package_name -eq '@ygncode/pi-web' -and $env:npm_package_version) {
    return 'v' + $env:npm_package_version.TrimStart('v')
  }
  return $null
}

function Get-LatestTag {
  try {
    $rel = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
    if ($rel.tag_name) { return $rel.tag_name }
  } catch {}
  # /latest ignores prereleases. Fall back to the newest release of any type
  # (GitHub orders by creation date; install.sh sorts by semver instead).
  $rels = @(Invoke-RestMethod "https://api.github.com/repos/${Repo}/releases?per_page=1")
  if ($rels.Count -gt 0 -and $rels[0].tag_name) { return $rels[0].tag_name }
  throw "Could not determine latest release tag from $Repo."
}

function Get-InstalledVersion {
  if (Test-Path $Binary) {
    try {
      $v = & $Binary -version 2>$null
      if ($v) { return "$v".Trim() }
    } catch {}
  }
  # Binary missing or not runnable (e.g. partial install); fall back to the
  # version file.
  if (Test-Path $VersionFile) { return (Get-Content $VersionFile -First 1) }
  return $null
}

function Get-Binary($arch, $tag) {
  $asset = "pi-web-windows-$arch.exe"
  $url = "https://github.com/$Repo/releases/download/$tag/$asset"
  Info "Downloading pi-web $tag (windows-$arch)..."
  Info "  $url"
  $tmpDir = Join-Path ([IO.Path]::GetTempPath()) ('pi-web-' + [IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $tmpDir | Out-Null
  $dest = Join-Path $tmpDir 'pi-web.exe'
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
  return $dest
}

function Stop-PiWeb {
  # Stop the running instance before swapping the binary. Skipped for in-place
  # self-updates: pi-web spawned this script (via `pi install`) and restarts
  # itself afterward (see internal/app/update.go).
  Get-Process -Name 'pi-web' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

function Install-Binary($src, $tag) {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  # A running executable cannot be overwritten on Windows, but it can be
  # renamed: move the old binary aside, move the new one into place, then try
  # to delete the leftover (harmlessly fails while the old process still runs;
  # the next install removes it).
  $old = "$Binary.old"
  Remove-Item $old -Force -ErrorAction SilentlyContinue
  if (Test-Path $Binary) { Move-Item $Binary $old -Force }
  Move-Item $src $Binary -Force
  Remove-Item $old -Force -ErrorAction SilentlyContinue

  New-Item -ItemType Directory -Force -Path (Split-Path $VersionFile) | Out-Null
  Set-Content -Path $VersionFile -Value $tag
  Info "pi-web $tag installed to $Binary"
}

function Set-EnvFileVar($file, $key, $value) {
  $lines = @()
  if (Test-Path $file) { $lines = @(Get-Content $file) }
  $found = $false
  $lines = @($lines | ForEach-Object {
    if ($_ -match ('^' + [regex]::Escape($key) + '=')) { $found = $true; "$key=$value" } else { $_ }
  })
  if (-not $found) { $lines += "$key=$value" }
  Set-Content -Path $file -Value $lines
}

function Initialize-EnvFile {
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
  if (-not (Test-Path $EnvFile)) { New-Item -ItemType File -Path $EnvFile | Out-Null }

  $hasToken = Select-String -Path $EnvFile -Pattern '^PI_WEB_TOKEN=' -Quiet
  if (-not $env:PI_WEB_TOKEN -and -not $hasToken) {
    $bytes = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    Set-EnvFileVar $EnvFile 'PI_WEB_TOKEN' $token
    Info "Generated PI_WEB_TOKEN in $EnvFile"
    Warn "Use this token when opening pi-web from another device: $token"
  }

  # Persist PI_CODING_AGENT_DIR so auto-started pi-web finds the right sessions.
  if ($env:PI_CODING_AGENT_DIR) { Set-EnvFileVar $EnvFile 'PI_CODING_AGENT_DIR' $env:PI_CODING_AGENT_DIR }

  # The Run-key launcher starts with the login default environment. Preserve
  # the install-time PATH so pi-web can find `pi` for browser chat.
  Set-EnvFileVar $EnvFile 'PATH' $env:Path
}

function Initialize-Autostart {
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

  $ps1 = @"
# Generated by pi-web install.ps1 — starts pi-web hidden with the environment
# from the env file (PI_WEB_TOKEN, PATH, ...). Regenerated on every install.
`$envFile = '$EnvFile'
if (Test-Path `$envFile) {
  foreach (`$line in Get-Content `$envFile) {
    if (`$line -match '^\s*#' -or `$line -notmatch '=') { continue }
    `$name, `$value = `$line -split '=', 2
    Set-Item -Path ('Env:' + `$name) -Value `$value
  }
}
Start-Process -FilePath '$Binary' -WindowStyle Hidden
"@
  Set-Content -Path $LauncherPs1 -Value $ps1

  # wscript runs the PowerShell launcher with window style 0 so login does not
  # flash a console window.
  $vbs = 'CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""' + $LauncherPs1 + '""", 0, False'
  Set-Content -Path $LauncherVbs -Value $vbs

  Set-ItemProperty -Path $RunKey -Name 'pi-web' -Value ('wscript.exe "' + $LauncherVbs + '"')
  Info 'Windows auto-start configured (Run key + hidden launcher)'
}

function Start-PiWeb {
  Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + $LauncherVbs + '"')
}

function Main {
  Write-Host ''
  Info 'pi-web installer (Windows)'
  Write-Host ''

  $arch = Get-Arch

  $tag = Get-PackageTag
  if ($tag) { Info "Using pi-web package version $tag." } else { $tag = Get-LatestTag }

  $installed = Get-InstalledVersion
  if ((Test-Path $Binary) -and $installed -eq $tag) {
    Info "Already up-to-date ($tag)."
    Write-Host ''
    return
  }
  if ($installed) { Info "Update available: $installed -> $tag" }

  $tmpBinary = Get-Binary $arch $tag

  $inplace = [bool]$env:PI_WEB_INPLACE_UPDATE
  if ((Test-Path $Binary) -and -not $inplace) { Stop-PiWeb }

  Install-Binary $tmpBinary $tag

  # In-place self-update: pi-web triggered this and restarts itself afterward.
  # Skip env/auto-start setup so we don't kill the npm process running this
  # script or clobber the launcher's PATH.
  if ($inplace) {
    Info "Binary updated to $tag; pi-web will restart to apply it."
    Write-Host ''
    return
  }

  Initialize-EnvFile
  Initialize-Autostart

  Info 'pi-web will listen on localhost; if Tailscale is running, it will publish HTTPS with Tailscale Serve.'
  Start-PiWeb

  Info "Done! pi-web $tag is ready."
  Write-Host ''
}

Main
