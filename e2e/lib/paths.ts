import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = join(E2E_ROOT, "..");

/** Path to the built pi-web binary. */
export const BINARY = join(REPO_ROOT, "pi-web");

/** Committed, sanitized session fixtures copied into the temp dir at setup. */
export const FIXTURES_SESSIONS = join(E2E_ROOT, "fixtures", "sessions");

/** Scratch dir for runtime state (server.json, temp agent dir). Git-ignored. */
export const TMP_DIR = join(E2E_ROOT, ".tmp");

/** Written by global-setup, read by the test fixture to discover the server. */
export const STATE_FILE = join(TMP_DIR, "server.json");

export interface ServerState {
  baseURL: string;
  /** Absolute path to the temp sessions dir the server is watching. */
  sessionsDir: string;
  /** Absolute path to the temp PI_CODING_AGENT_DIR. */
  agentDir: string;
  pid: number;
}
