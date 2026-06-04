# pi-web (Remote Control Your Pi)

Drive your [pi](https://pi.dev) coding agent from any browser on your network — laptop, phone, or tablet.

> [!WARNING]
> pi-web is currently in **beta**. Things will change and break!

## Screenshots

<div align="center">
  <img src="assets/desktop-dark-mode.png" alt="Desktop — dark mode" width="90%" /><br />
  <em>Desktop — dark mode</em>
  <br /><br />
  <img src="assets/desktop-white-mode.png" alt="Desktop — light mode" width="90%" /><br />
  <em>Desktop — light mode</em>
  <br /><br />
  <img src="assets/mobile-pwa.png" alt="Mobile PWA" width="90%" /><br />
  <em>Mobile PWA</em>
</div>

## How It Fits Together

```
 pi (terminal)                 Browser (phone / tablet / laptop)
      │                                │
      │  writes JSONL                  │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (Go HTTP server)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (per‑session       (live reload)      (remote HTTPS
             chat worker)                           via MagicDNS)
```

- **pi** writes conversation JSONL to `~/.pi/agent/sessions/` as it works.
- **pi-web** is a Go server that reads those files, renders them in the browser, and streams live updates via SSE.
- **pi --mode rpc** workers handle browser-initiated chat — one per session, reaped after 10 min idle.
- **fsnotify** watches the sessions directory so the browser reloads within milliseconds of new output.
- **Tailscale Serve** publishes the localhost server as an HTTPS endpoint on your tailnet.

## Install

```bash
pi install npm:@ygncode/pi-web@beta
```

That's it — it downloads the matching binary, sets up auto‑start, and registers the `/web`, `/remote`, and `/refresh` commands.

Once installed, open `http://127.0.0.1:31415` in your browser. From pi, use `/web` to open the current session in your browser instantly. If Tailscale is running on your machine, pi-web automatically publishes an HTTPS endpoint on your tailnet — use `/remote` from pi to get a QR code and URL for any device on your tailnet.

For manual installs, binary downloads, or building from source, see [docs/install.md](docs/install.md).

## Pi Integration

After `pi install npm:@ygncode/pi-web@beta`, you get:

| Command | What it does |
|---------|--------------|
| `/web` | Open the current session in your browser (SSH-aware: skips browser and shows URL only) |
| `/pi-web` | Show status, version, start/stop/restart the server, or update |
| `/remote` | Show a QR code and URL for remote access over Tailscale |
| `/refresh` | Pull new messages written from remote browsers back into the terminal session |

Session **auto-titling** is built into pi-web itself and configured on the `/settings` page. It's **on by default** and names sessions automatically. You can choose:

- **When to title** — once per session, or on every new message (the default).
- **Title model** — a free, instant **built-in word heuristic (no AI)** by default, or pick a model (e.g. a small/fast one) for smarter, model-written titles.

The package also installs the pi-web binary to `~/.pi/agent/bin/pi-web` and sets up auto-start on login.

## Auto-Start on Login

The `pi install npm:@ygncode/pi-web@beta` command sets this up automatically:

| OS | Mechanism |
|----|-----------|
| macOS | launchd plist at `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | systemd user service at `~/.config/systemd/user/pi-web.service` |

To set a token for remote access, create `~/.config/pi-web/env`:

```
PI_WEB_TOKEN=your-token-here
```

For more details (manual setup, custom ports, non-loopback binds), see [docs/install.md](docs/install.md).

## Development

```bash
make setup   # install frontend deps and download Go modules
make check   # frontend test/build + Go test/vet
make build   # setup if needed, build frontend, then build ./pi-web
```

## License

MIT
