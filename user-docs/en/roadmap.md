# Roadmap

pi-web is built for two audiences:

- **For developers** — who live in the terminal but want to continue sessions from mobile, hand off to a remote server, or keep an eye on long-running tasks from anywhere.
- **For non-developers** — who just want a beautiful AI app that works. Open it, type, vibe. No terminal, no SSH, no confusion. Like the most user-friendly AI tools, but with model choice and open-source freedom.

Here's what's coming.

---

## Now (shipped)

Everything listed in [the features table](README.md#what-you-can-do-with-pi-web) is live today.

Features that used to be on this roadmap and have since shipped:

| Feature | What it does |
|---|---|
| **Steering / queue** ([#46](https://github.com/ygncode/pi-web/issues/46)) | Send follow-up instructions while pi is still running, or queue messages for the next turn. |
| **Scheduler** ([#44](https://github.com/ygncode/pi-web/issues/44)) | Schedule prompts to run automatically — daily standups, morning summaries, recurring tasks — from the `/schedules` page. |
| **Configurable display defaults** ([#48](https://github.com/ygncode/pi-web/issues/48)) | Set your preferred visibility for thinking, tools, and tool outputs across all sessions. |
| **Git diff** (part of [#47](https://github.com/ygncode/pi-web/issues/47)) | See uncommitted working-tree changes in the session diff modal, with review comments. |

---

## Next up

| # | Feature | What it does |
|---|---|---|
| [#50](https://github.com/ygncode/pi-web/issues/50) | **Telegram & Discord bots** | Chat with pi through Telegram or Discord — perfect for personal assistant workflows on the go. |
| [#49](https://github.com/ygncode/pi-web/issues/49) | **Usage insights** | Cross-session token tracking, cost estimation, and analytics — beyond the per-session breakdown in the session menu. |
| [#41](https://github.com/ygncode/pi-web/issues/41) | **`/compact` command** | Compact long conversations right from the web UI, no terminal needed. |

---

## Planned

| # | Feature | What it does |
|---|---|---|
| [#47](https://github.com/ygncode/pi-web/issues/47) | **File Explorer** | Browse the project file tree directly in pi-web. Opt-in, so it stays out of your way. |
| [#43](https://github.com/ygncode/pi-web/issues/43) | **Customizable shortcuts** | Remap every keyboard shortcut to match your muscle memory. |

---

## Vision

The long-term goal: pi-web should be **the interface for pi** — for everyone.

- **Non-devs** open it like any other app. Pick a model. Type. Done. No command line ever.
- **Devs** get deep integration — remote handoff, multi-session dashboards, git-aware browsing, messaging bots.
- **Everyone** gets model freedom, open-source transparency, and a UI that feels thoughtful at every turn.

---

> 💡 Have an idea? [Open an issue](https://github.com/ygncode/pi-web/issues/new) or join the discussion.
