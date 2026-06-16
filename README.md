<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dt/@ygncode/pi-web?label=downloads&color=2ea043)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb)](LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

**English** · [Español](user-docs/readme/README.es.md) · [Français](user-docs/readme/README.fr.md) · [Deutsch](user-docs/readme/README.de.md) · [中文](user-docs/readme/README.zh.md) · [日本語](user-docs/readme/README.ja.md) · [Bahasa Indonesia](user-docs/readme/README.id.md) · [Bahasa Melayu](user-docs/readme/README.ms.md) · [Tiếng Việt](user-docs/readme/README.vi.md) · [ไทย](user-docs/readme/README.th.md) · [Filipino](user-docs/readme/README.fil.md) · [မြန်မာ](user-docs/readme/README.my.md) · [ភាសាខ្មែរ](user-docs/readme/README.km.md) · [ລາວ](user-docs/readme/README.lo.md)

</div>

<div align="center">

Drive your [pi](https://pi.dev) coding agent from your phone, tablet, or laptop — anywhere on your network, or remotely over Tailscale.

It's a full PWA, so you can install it and use it like a native app on any device. Think of it as your own personal AI workspace — like Claude's Cowork, but with different models — chat across models, code from your phone, or turn it into a [personal assistant](user-docs/en/personal-assistant.md) that lives on your machine.

Make it yours: switch themes and fonts, and use it in your own language — pi-web ships with multiple languages and you can add your own. More features are on the way, but it won't get bloated: anything you don't need can be turned off in settings.

</div>

> [!WARNING]
> pi-web is currently in **beta**. Things will change and break!

> [!TIP]
> New here? **[Read the user guide →](user-docs/en/README.md)** for a full tour of features, install steps, and tips. ([Other languages →](user-docs/README.md))

## Screenshots

<div align="center">
  <img src="user-docs/assets/desktop-dark-mode.png" alt="Desktop — dark mode" width="90%" /><br />
  <em>Desktop — dark mode</em>
  <br /><br />
  <img src="user-docs/assets/desktop-white-mode.png" alt="Desktop — light mode" width="90%" /><br />
  <em>Desktop — light mode</em>
  <br /><br />
  <img src="user-docs/assets/mobile-pwa.png" alt="Mobile PWA" width="90%" /><br />
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

That's it — it downloads the matching binary, sets up auto‑start, and registers the `/web`, `/pi-web`, `/remote`, and `/refresh` commands.

Once installed, open `http://127.0.0.1:31415` in your browser. From pi, use `/web` to open the current session in your browser instantly. If Tailscale is running on your machine, pi-web automatically publishes an HTTPS endpoint on your tailnet — use `/remote` from pi to get a QR code and URL for any device on your tailnet.

For manual installs, binary downloads, or building from source, see [user-docs/install.md](user-docs/en/install.md).

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

For more details (manual setup, custom ports, non-loopback binds), see [user-docs/install.md](user-docs/en/install.md).

## Development

```bash
make setup   # install frontend deps and download Go modules
make check   # frontend test/build + Go test/vet
make build   # setup if needed, build frontend, then build ./pi-web
```

