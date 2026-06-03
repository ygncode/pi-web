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
  const res = await fetch(`${baseURL}/api/settings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings: { "pi-web:v1:cat:enabled": "false" } }),
  });
  if (!res.ok) {
    throw new Error(`failed to disable cat gatekeeper: HTTP ${res.status}`);
  }

  const state: ServerState = { baseURL, agentDir, sessionsDir, pid: child.pid! };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`[e2e] pi-web ready at ${baseURL} (pid ${child.pid})`);

  // Detach so the spawned server outlives this setup process; teardown kills by pid.
  child.unref();
}
