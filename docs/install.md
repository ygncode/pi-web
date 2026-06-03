# Installation & Usage

## Features

### Remote control

- Continue any session from the browser with text or image attachments
- Start a brand-new session against any project path, right from the web UI
- In-browser model switching and thinking-level selector, per session
- Per-session worker status (idle / running / error) with auto-recovery on crash
- Multiple sessions run in parallel — kick off work in one, watch another stream
- `PI_WEB_TOKEN` for safe LAN exposure — required by default for any explicit non-loopback bind

### Reading sessions

- Browse sessions across projects with filters, search, and full branch navigation
- Live incremental updates while pi is still running (via fsnotify; ~ms latency)
- Follow mode for tailing active sessions
- Deep links to individual messages
- Download a session as JSONL
- Share static snapshots as secret GitHub Gists
- `/web`, `/remote`, `/refresh`, `/pi-web token` and `/pi-web set-token` pi extensions for opening sessions, remote QR, session sync, and token management

## Requirements

- [Go](https://go.dev) 1.25+
- `pi` on your `PATH` for browser chat/model switching
- Optional: `gh` for sharing

## Install

### Pi package (recommended)

```bash
pi install npm:@ygncode/pi-web
```

This single command:
- Installs the npm pi package under pi's package directory
- Runs the package `postinstall` script (`bash install.sh`)
- Downloads the correct pi-web binary for your platform from GitHub Releases
- Installs it to `~/.pi/agent/bin/pi-web`
- Sets up auto-start on login (launchd on macOS, systemd on Linux)
- Registers the `/web`, `/remote`, `/refresh`, `/pi-web token`, and `/pi-web set-token` pi commands

Session auto-titling is built into pi-web (not the extension) and configured on the `/settings` page. It's on by default: pi-web names sessions automatically using a free built-in word heuristic (no AI), re-titling on every new message. You can switch to titling once per session, and/or pick a model to write smarter titles instead of the heuristic.

On Linux, auto-start is configured as a user systemd service at `~/.config/systemd/user/pi-web.service`. The installer rewrites its `ExecStart` to the actual installed binary path. If Tailscale is available at runtime, pi-web publishes the localhost server with Tailscale Serve HTTPS. If user systemd is unavailable, run it manually with `~/.pi/agent/bin/pi-web -o`.

To install only for a specific project (shared with your team via `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web
```

Then restart pi (or run `/reload`), and use `/web`, `/pi-web`, `/remote`, `/refresh`. Manage your access token with `/pi-web token` and `/pi-web set-token`.

### Quick install (no build tools needed)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

This downloads the latest pi-web binary, installs it to `/usr/local/bin`, and sets up auto-start on login. No Go, Node, or pi required.

### Download binary

Pre-built binaries are attached to each [GitHub Release](https://github.com/ygncode/pi-web/releases).

```bash
# macOS (Apple Silicon)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-arm64
chmod +x pi-web

# macOS (Intel)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-amd64
chmod +x pi-web

# Linux (amd64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-amd64
chmod +x pi-web

# Linux (arm64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-arm64
chmod +x pi-web
```

Then move it to your PATH:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### Build from source

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

The frontend bundle is embedded by `web/assets_embed.go`, so `go build` needs
`web/dist` to exist first. `make build` does both steps in order; if you build
by hand, run `npm --prefix web install && npm --prefix web run build` before
`go build ./cmd/pi-web`.

## Usage

```bash
# Start on the default port (31415)
pi-web

# Start and open a browser
pi-web -o

# Custom port
pi-web -p 8080

# Override bind host (loopback is unauthenticated by default)
pi-web --host 127.0.0.1

# Non-loopback bind requires a token — pi-web refuses to start otherwise
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

By default, pi-web binds to `127.0.0.1`. If Tailscale is running with MagicDNS, pi-web also runs `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` and prints the HTTPS tailnet URL. Any explicit non-loopback bind requires `PI_WEB_TOKEN` to be set; pass `--insecure` to override for local testing.

## Remote Access

Leave pi-web listening locally, then use the printed Tailscale HTTPS URL from your phone or laptop on the tailnet.

On Linux, allow your user to manage Tailscale before installing/running pi-web, otherwise `tailscale serve` may require sudo and auto-start can fail:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web
pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL.
```

> By default, pi-web refuses to bind to a non-loopback address unless `PI_WEB_TOKEN` is set — anyone who can reach the bound address could otherwise view sessions and send instructions to pi. To override this guard for local-network testing, pass `--insecure`. **Don't use `--insecure` on Tailscale or any address reachable from outside your machine.**
>
> Clients can pass the token via the `Authorization: Bearer <token>` header, the `X-Pi-Token` header, or once via `?token=<token>` (which sets a `pi_token` cookie for subsequent requests). Tokens passed via `?token=` end up in browser history, server access logs, and `Referer` headers from any links on the page — prefer the header form for anything beyond the initial bookmark.

## Browser Chat

Open a session page and use the composer at the bottom to continue that exact session.

- `Enter` sends, `Shift+Enter` inserts a newline
- Drag-and-drop or paste images directly into the composer
- The model picker and thinking-level selector live in the header — changes apply to the underlying pi worker immediately
- Each active session gets its own dedicated `pi --mode rpc` worker, so different sessions don't block each other

## Sharing Sessions

Click **Share** on a session page to create a secret GitHub Gist.

Requirements:
- `gh` installed
- `gh auth login` completed

Sharing returns:
- the secret gist URL
- a preview URL at `https://pi.dev/session/#<gistId>`

Shared gists are snapshots and do not live-update.

## Auto-Start on Login

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Install the systemd user service
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Optional: set your PI_WEB_TOKEN for non-loopback binds
# (or use /pi-web set-token <token> from inside pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Enable and start
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Check status
systemctl --user status pi-web.service

# View logs
journalctl --user -u pi-web.service -f
```

> For the service to start at boot (before login), use a system service instead:
> copy `init/pi-web.service` to `/etc/systemd/system/` and use `sudo systemctl`.
