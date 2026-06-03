import { existsSync, readFileSync, rmSync } from "node:fs";
import { STATE_FILE, type ServerState } from "./lib/paths";
import { stopServer } from "./lib/server";

export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  try {
    const state: ServerState = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    stopServer(state.pid);
    rmSync(state.agentDir, { recursive: true, force: true });
  } finally {
    rmSync(STATE_FILE, { force: true });
  }
}
