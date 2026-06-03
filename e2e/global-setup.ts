import { mkdirSync, writeFileSync } from "node:fs";
import { STATE_FILE, TMP_DIR, type ServerState } from "./lib/paths";
import { startServer } from "./lib/server";

export default async function globalSetup() {
  mkdirSync(TMP_DIR, { recursive: true });
  const { baseURL, agentDir, sessionsDir, child } = await startServer();

  const state: ServerState = { baseURL, agentDir, sessionsDir, pid: child.pid! };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`[e2e] pi-web ready at ${baseURL} (pid ${child.pid})`);

  // Detach so the spawned server outlives this setup process; teardown kills by pid.
  child.unref();
}
