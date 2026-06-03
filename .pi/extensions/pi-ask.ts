import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// pi-ask ships pi-web's own `ask_user_question` tool so the browser question
// card works without the user installing a third-party extension.
//
// It is intentionally active ONLY under pi-web's `pi --mode rpc` worker. In
// that flow there is no TUI to collect an answer; instead the browser renders
// the tool call, the user clicks an option, and pi-web sends the choice back as
// an ordinary chat message (`"Question" = "Answer"`). The tool therefore does
// not block on a TUI dialog — it records the questions, returns an
// `awaitingChatReply` result, and tells the model to stop and wait for that
// follow-up message.

export interface AskQuestionOption {
  label?: unknown;
  description?: unknown;
}

export interface AskQuestion {
  question?: unknown;
  header?: unknown;
  multiSelect?: unknown;
  options?: unknown;
}

export interface AskToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: { awaitingChatReply: true; questionCount: number };
}

// pi-web spawns the worker as `pi --mode rpc`. `ctx.hasUI` is true in both
// interactive and RPC mode, so it cannot distinguish them — argv can.
export function isRpcMode(argv: string[] = process.argv): boolean {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mode" || arg === "-mode") {
      if (argv[i + 1] === "rpc") return true;
    }
    if (arg === "--mode=rpc" || arg === "-mode=rpc") return true;
  }
  return false;
}

function questionText(q: AskQuestion, index: number): string {
  return typeof q?.question === "string" && q.question.trim()
    ? q.question
    : `Question ${index + 1}`;
}

export function buildAwaitingResult(questions: AskQuestion[]): AskToolResult {
  const list = Array.isArray(questions) ? questions : [];
  const count = list.length;
  const summary = list
    .map((q, i) => `  ${i + 1}. ${questionText(q, i)}`)
    .join("\n");

  const text =
    `Presented ${count} question${count === 1 ? "" : "s"} to the user in pi-web. ` +
    `The question card is shown inline in the conversation (there is no sidebar, ` +
    `panel, or popup) — do not describe a UI location or invent one.\n` +
    `Stop now and wait for the user's reply. It arrives as the next user ` +
    `message formatted as "Question" = "Answer" (multi-select answers are ` +
    `comma-separated). Keep any acknowledgement brief; do not answer on the ` +
    `user's behalf or call this tool again until they respond.` +
    (summary ? `\n\nQuestions awaiting an answer:\n${summary}` : "");

  return {
    content: [{ type: "text", text }],
    details: { awaitingChatReply: true, questionCount: count },
  };
}

// ── pi_web_ tool preference ─────────────────────────────────────────────
// pi-web ships its tools under a `pi_web_` prefix to avoid name clashes with
// third-party providers (e.g. ghoseb/pi-askuserquestion's `ask_user_question`).
// Those bare-named providers generally crash in pi-web's headless RPC worker
// (they rely on `ctx.ui.custom()`, which returns undefined in RPC mode). So when
// a tool exists under both `X` and `pi_web_X`, we steer the model to the
// `pi_web_` one: a soft system-prompt nudge plus a hard tool_call redirect.

export const PI_WEB_PREFIX = "pi_web_";

// Tools this extension registers — always treated as the canonical twin even if
// `selectedTools` is unavailable on the first turn.
export const OWN_PI_WEB_TOOLS = ["pi_web_ask_user_question"];

// `selectedTools` may be an array of names or of tool-definition objects.
export function extractToolNames(selectedTools: unknown): string[] {
  if (!Array.isArray(selectedTools)) return [];
  const names: string[] = [];
  for (const t of selectedTools) {
    if (typeof t === "string") {
      names.push(t);
    } else if (t && typeof t === "object") {
      const n =
        (t as { name?: unknown }).name ??
        (t as { toolName?: unknown }).toolName ??
        (t as { id?: unknown }).id;
      if (typeof n === "string") names.push(n);
    }
  }
  return names;
}

// Bare tool names X for which a `pi_web_X` twin is also active.
export function findPiWebOverlaps(
  activeNames: string[],
  ownTools: string[] = OWN_PI_WEB_TOOLS,
): string[] {
  const twins = new Set<string>(ownTools);
  for (const n of activeNames) {
    if (n.startsWith(PI_WEB_PREFIX)) twins.add(n);
  }
  const overlaps: string[] = [];
  for (const n of new Set(activeNames)) {
    if (n.startsWith(PI_WEB_PREFIX)) continue;
    if (twins.has(`${PI_WEB_PREFIX}${n}`)) overlaps.push(n);
  }
  return overlaps;
}

export function buildSteeringNote(overlaps: string[]): string {
  const pairs = overlaps
    .map((n) => `"${n}" -> "${PI_WEB_PREFIX}${n}"`)
    .join(", ");
  return (
    `pi-web tool preference: this session runs inside pi-web. When a tool is ` +
    `available under both a bare name and a "${PI_WEB_PREFIX}"-prefixed name, ` +
    `always call the "${PI_WEB_PREFIX}"-prefixed one — the bare equivalents are ` +
    `not supported here and will fail. Affected tools: ${pairs}.`
  );
}

// If `toolName` is a bare name whose `pi_web_` twin is registered/active, return
// that twin so the caller can redirect; otherwise null.
export function redirectTwin(
  toolName: unknown,
  piWebTools: Set<string>,
): string | null {
  if (typeof toolName !== "string" || toolName.startsWith(PI_WEB_PREFIX)) {
    return null;
  }
  const twin = `${PI_WEB_PREFIX}${toolName}`;
  return piWebTools.has(twin) ? twin : null;
}

export default function (pi: ExtensionAPI) {
  // Only pi-web's RPC worker can route answers back through the browser. In
  // interactive/print/JSON modes this tool would have no way to be answered, so
  // we don't register it and leave that mode to a real interactive provider.
  if (!isRpcMode()) return;

  // Named with the pi-web prefix (like pi_web_set_tab_title) so it never
  // collides with a separately-installed `ask_user_question` provider such as
  // ghoseb/pi-askuserquestion — a name clash makes pi refuse to load both.
  pi.registerTool({
    name: "pi_web_ask_user_question",
    label: "Ask User Question",
    description:
      "Ask the user one or more structured multiple-choice questions when you " +
      "need a decision before proceeding. The questions are shown in pi-web; " +
      "the user picks options in the browser and their answer returns as a " +
      "follow-up chat message. Prefer this over guessing when the user's intent " +
      "is ambiguous and a small set of options would resolve it.",
    promptSnippet:
      "Use pi_web_ask_user_question to ask the user structured multiple-choice " +
      "questions, then stop and wait for their reply.",
    promptGuidelines: [
      "Call pi_web_ask_user_question when a decision is ambiguous and 2-4 concrete options would resolve it, instead of guessing.",
      "Keep each option label short; put rationale in the option description.",
      "After calling pi_web_ask_user_question, stop and wait — the user's answer arrives as the next message.",
    ],
    parameters: Type.Object({
      questions: Type.Array(
        Type.Object({
          question: Type.String({
            description: "Full question text shown to the user.",
          }),
          header: Type.Optional(
            Type.String({
              description: "Short tab label for this question (max 12 chars).",
            }),
          ),
          multiSelect: Type.Optional(
            Type.Boolean({
              description:
                "true = the user may select multiple options; false = single choice.",
            }),
          ),
          options: Type.Array(
            Type.Object({
              label: Type.String({
                description: "The answer value returned when chosen.",
              }),
              description: Type.Optional(
                Type.String({
                  description: "Optional hint shown beneath the label.",
                }),
              ),
            }),
            {
              minItems: 2,
              maxItems: 4,
              description: "2-4 answer options.",
            },
          ),
        }),
        {
          minItems: 1,
          maxItems: 4,
          description: "1-4 questions to ask the user.",
        },
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const questions = Array.isArray((params as { questions?: unknown })?.questions)
        ? ((params as { questions: AskQuestion[] }).questions)
        : [];
      return buildAwaitingResult(questions);
    },
  });

  // Names active in the current prompt, refreshed each turn. Seeded with our own
  // tool so the tool_call guard works even before the first before_agent_start.
  let activePiWebTools = new Set<string>(OWN_PI_WEB_TOOLS);

  // Soft nudge: when a bare/`pi_web_` overlap exists, tell the model to prefer
  // the prefixed tool. Also refreshes the active-tool set for the guard below.
  pi.on("before_agent_start", async (event) => {
    const active = extractToolNames(
      (event as { systemPromptOptions?: { selectedTools?: unknown } })
        ?.systemPromptOptions?.selectedTools,
    );
    activePiWebTools = new Set<string>(OWN_PI_WEB_TOOLS);
    for (const n of active) {
      if (n.startsWith(PI_WEB_PREFIX)) activePiWebTools.add(n);
    }

    const overlaps = findPiWebOverlaps(active);
    if (overlaps.length === 0) return undefined;
    const basePrompt =
      typeof (event as { systemPrompt?: unknown }).systemPrompt === "string"
        ? (event as { systemPrompt: string }).systemPrompt
        : "";
    return { systemPrompt: `${basePrompt}\n\n${buildSteeringNote(overlaps)}` };
  });

  // Hard redirect: if the model calls a bare tool whose `pi_web_` twin exists,
  // block it before it executes (preventing the third-party tool's RPC crash)
  // and point the model at the supported tool.
  pi.on("tool_call", async (event) => {
    const name = (event as { toolName?: unknown }).toolName;
    const twin = redirectTwin(name, activePiWebTools);
    if (!twin) return undefined;
    return {
      block: true,
      reason:
        `pi-web ships its own "${twin}" — call that instead of "${String(name)}". ` +
        `The bare "${String(name)}" tool is not supported in pi-web sessions ` +
        `and fails in the headless RPC worker.`,
    };
  });
}
