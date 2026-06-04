import { mkdirSync, writeFileSync } from "node:fs";
import { STATE_FILE, TMP_DIR, type ServerState } from "./lib/paths";
import { startServer } from "./lib/server";

export default async function globalSetup() {
  mkdirSync(TMP_DIR, { recursive: true });
  const { baseURL, agentDir, sessionsDir, child } = await startServer();

  // Disable the "cat" focus/bedtime gatekeeper globally. Its sleep overlay is
  // time-of-day driven (default bedtime 23:00-07:00) and covers the UI,
  // intercepting clicks — which silently breaks click-based tests on CI runners
  // in that window (e.g. UTC night). Seed it off in the server-side store so
  // every page hydrates with it disabled.
  // Also disable auto-titling: with the stub model it appends a session_info
  // line and broadcasts a "reload" at an unpredictable moment, re-rendering
  // #messages and racing tests that assert on freshly-created DOM (e.g.
  // annotation highlights). Deterministic test env > background titling.
  const res = await fetch(`${baseURL}/api/settings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Show all artifacts by default (empty include filter). The product default
    // is "*.md, *.html", which would hide the .go writes and code snippets the
    // artifacts behavior tests assert on. The dedicated filter tests opt into a
    // filter explicitly; everything else runs unfiltered for determinism.
    body: JSON.stringify({
      settings: {
        "pi-web:v1:cat:enabled": "false",
        "pi-web:v1:auto-title:enabled": "false",
        "pi-web:v1:artifacts:include": "",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`failed to seed test settings: HTTP ${res.status}`);
  }

  const state: ServerState = { baseURL, agentDir, sessionsDir, pid: child.pid! };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`[e2e] pi-web ready at ${baseURL} (pid ${child.pid})`);

  // Detach so the spawned server outlives this setup process; teardown kills by pid.
  child.unref();
}
