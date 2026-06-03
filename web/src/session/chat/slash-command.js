// Slash-command palette for the chat composer. Typing "/" at the start of the
// message opens a popup listing every command pi loaded for the session
// (extensions, prompt templates, and skills), filtered as you type. Picking one
// inserts "/<name> " into the composer.
//
// Commands only count to pi when the message *starts* with the slash, so the
// trigger is deliberately anchored to position 0 — a slash mid-message (e.g. a
// file path) never opens the palette.

const SOURCE_ORDER = ["prompt", "skill"];
const SOURCE_LABELS = {
  prompt: "Prompts",
  skill: "Skills",
};

// Only prompt templates and skills expand into a normal agent turn over the
// headless RPC worker. Extension commands (e.g. /insights, /view) drive pi's
// TUI via extension_ui_request events and never emit agent_end, so sending one
// leaves the session stuck "running" forever. They are excluded from the
// palette rather than offered and then hanging the composer.
const PALETTE_SOURCES = new Set(["prompt", "skill"]);

export function isPaletteCommand(cmd) {
  return !!cmd && PALETTE_SOURCES.has(cmd.source);
}

// parseSlashTrigger inspects the textarea value + caret position and returns the
// active command token, or null when the palette should not be open. The token
// spans from the leading "/" (which must be the first character) up to the first
// whitespace; once the caret moves past that token (i.e. the user typed a space
// and is now writing arguments) it returns null so the popup closes.
export function parseSlashTrigger(text, caret) {
  if (typeof text !== "string" || !text.startsWith("/")) return null;
  const wsMatch = text.match(/\s/);
  const tokenEnd = wsMatch ? wsMatch.index : text.length;
  if (caret > tokenEnd) return null;
  return { query: text.slice(1, tokenEnd), start: 0, end: tokenEnd };
}

export function filterCommands(commands, query) {
  const list = Array.isArray(commands) ? commands : [];
  const q = (query || "").toLowerCase();
  if (!q) return list.slice();
  return list.filter((c) => (c.name || "").toLowerCase().includes(q));
}

// groupCommands returns ordered, non-empty groups (extensions, prompts, skills).
// Sources pi may add in the future fall into a trailing "Other" group so they
// are still reachable rather than silently dropped.
export function groupCommands(commands) {
  const buckets = new Map();
  (commands || []).forEach((c) => {
    const source = c.source || "other";
    if (!buckets.has(source)) buckets.set(source, []);
    buckets.get(source).push(c);
  });
  const groups = [];
  SOURCE_ORDER.forEach((source) => {
    if (buckets.has(source)) {
      groups.push({
        source,
        label: SOURCE_LABELS[source],
        items: buckets.get(source),
      });
      buckets.delete(source);
    }
  });
  for (const [source, items] of buckets) {
    groups.push({ source, label: "Other", items, _source: source });
  }
  return groups;
}

export function renderCommandList(
  commands,
  { query = "", escapeHtml = String, loading = false } = {},
) {
  if (loading) return '<div class="slash-empty">Loading commands…</div>';
  const filtered = filterCommands(commands, query);
  if (filtered.length === 0)
    return '<div class="slash-empty">No commands match</div>';

  let html = "";
  groupCommands(filtered).forEach((group) => {
    html += `<div class="slash-group">${escapeHtml(group.label)}</div>`;
    group.items.forEach((cmd) => {
      const name = cmd.name || "";
      const desc = cmd.description || "";
      const descHtml = desc
        ? `<span class="slash-item-desc">${escapeHtml(desc)}</span>`
        : "";
      html +=
        `<button type="button" class="slash-item" data-insert="${escapeHtml(name)}">` +
        `<span class="slash-item-name">/${escapeHtml(name)}</span>${descHtml}</button>`;
    });
  });
  return html;
}

export function setupSlashCommands({
  documentImpl = document,
  sessionId,
  chatApi,
  escapeHtml = String,
} = {}) {
  const textarea = documentImpl.getElementById("pi-chat-message");
  const popup = documentImpl.getElementById("pi-chat-slash-popup");
  const list = documentImpl.getElementById("pi-chat-slash-list");
  if (!textarea || !popup || !list) return { handleKeydown: () => false };

  let allCommands = [];
  let loaded = false;
  let loading = false;
  let trigger = null;

  function isOpen() {
    return popup.style.display !== "none" && popup.style.display !== "";
  }

  function items() {
    return list.querySelectorAll(".slash-item");
  }

  function setActive(index) {
    const all = items();
    const clamped = Math.max(0, Math.min(index, all.length - 1));
    list.dataset.activeIndex = String(all.length ? clamped : -1);
    all.forEach((el, i) => el.classList.toggle("active", i === clamped));
    all[clamped]?.scrollIntoView?.({ block: "nearest" });
  }

  function render() {
    list.innerHTML = renderCommandList(allCommands, {
      query: trigger ? trigger.query : "",
      escapeHtml,
      loading: loading && !loaded,
    });
    setActive(0);
  }

  function open() {
    popup.style.display = "block";
    render();
    if (!loaded && !loading) {
      loading = true;
      render();
      chatApi
        .getCommands(sessionId, { load: true })
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("commands error")),
        )
        .then((data) => {
          allCommands = (data.commands || []).filter(isPaletteCommand);
        })
        .catch(() => {
          allCommands = [];
        })
        .finally(() => {
          loaded = true;
          loading = false;
          if (isOpen()) render();
        });
    }
  }

  function close() {
    popup.style.display = "none";
    trigger = null;
  }

  function refresh() {
    const next = parseSlashTrigger(
      textarea.value,
      textarea.selectionStart ?? textarea.value.length,
    );
    if (!next) {
      if (isOpen()) close();
      return;
    }
    const wasOpen = isOpen();
    trigger = next;
    if (wasOpen) render();
    else open();
  }

  function insert(name) {
    if (!trigger) return;
    const value = textarea.value;
    const replacement = `/${name} `;
    textarea.value =
      value.slice(0, trigger.start) + replacement + value.slice(trigger.end);
    const caret = trigger.start + replacement.length;
    textarea.selectionStart = textarea.selectionEnd = caret;
    close();
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Called by the composer's own keydown handler *before* its Enter-to-submit
  // logic so navigation/selection wins while the palette is open. Returns true
  // when the key was consumed.
  function handleKeydown(event) {
    if (!isOpen()) return false;
    const all = items();
    let active = parseInt(list.dataset.activeIndex || "-1", 10);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive(active + 1);
        return true;
      case "ArrowUp":
        event.preventDefault();
        setActive(active - 1);
        return true;
      case "Enter":
      case "Tab":
        if (active >= 0 && all[active]) {
          event.preventDefault();
          all[active].click();
          return true;
        }
        return false;
      case "Escape":
        event.preventDefault();
        close();
        return true;
      default:
        return false;
    }
  }

  textarea.addEventListener("input", refresh);

  list.addEventListener("click", (event) => {
    const item = event.target.closest(".slash-item");
    if (!item) return;
    insert(item.dataset.insert || "");
  });

  documentImpl.addEventListener("click", (event) => {
    if (isOpen() && !popup.contains(event.target) && event.target !== textarea)
      close();
  });

  return { handleKeydown, open, close, isOpen, refresh };
}
