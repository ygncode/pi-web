# Slash Command List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Add a `/` command palette to pi-web that shows available slash commands and lets users select one to execute via chat.

**Architecture:** pi-web's Go backend exposes a `/api/commands` endpoint that returns a static list of known slash commands (pi builtins + pi-web extension commands). The frontend adds a command palette UI that triggers when the user types `/` in the chat input, filtering and displaying matching commands, and inserting the selected command into the chat input field.

**Tech Stack:** Go (server endpoint), vanilla JavaScript (frontend UI), CSS (styling)

---

## Task 1: Add `/api/commands` Go endpoint

**Files:**
- Create: `internal/server/commands.go`
- Modify: `internal/server/server.go` (register route)
- Test: `internal/server/commands_test.go`

The endpoint returns a JSON array of command objects with `name` and `description` fields.

- [ ] **Step 1: Create `internal/server/commands.go`**

```go
package server

var builtinCommands = []map[string]string{
	{ "name": "/compact", "description": "Compact conversation history" },
	{ "name": "/clear", "description": "Clear conversation" },
	{ "name": "/model", "description": "Switch model" },
	{ "name": "/thinking", "description": "Change thinking level" },
	{ "name": "/web", "description": "Open current session in browser" },
	{ "name": "/refresh", "description": "Sync web-written messages back into session" },
	{ "name": "/remote", "description": "Show QR code for remote access" },
	{ "name": "/pi-web", "description": "Manage pi-web: status, token, start, stop" },
}

func (s *Server) handleCommands(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, 0, map[string]any{"commands": builtinCommands})
}
```

- [ ] **Step 2: Register route in `server.go`**

Add to `Register()`:
```go
mux.HandleFunc("/api/commands", s.auth.Wrap(s.handleCommands))
```

- [ ] **Step 3: Write test**

```go
package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleCommands(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/api/commands", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var result map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	commands, ok := result["commands"].([]any)
	if !ok || len(commands) == 0 {
		t.Fatal("expected non-empty commands array")
	}
}

func TestHandleCommandsRejectsPost(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodPost, "/api/commands", nil)
	w := httptest.NewRecorder()
	s.handleCommands(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}
```

- [ ] **Step 4: Run tests**

```bash
cd D:/Workstation/pi-web && go test ./internal/server/ -run TestHandleCommands -v
```

- [ ] **Step 5: Commit**

```bash
git add internal/server/commands.go internal/server/commands_test.go internal/server/server.go
git commit -m "feat: add /api/commands endpoint for slash command list"
```

---

## Task 2: Add command palette JS module

**Files:**
- Create: `web/src/session/chat/command-palette.js`
- Create: `web/src/session/chat/command-palette.test.js`

The module exports `setupCommandPalette({ chatInput, documentImpl, windowImpl, fetchImpl, sessionId })` which:
1. Listens for `/` keypress in the chat input
2. Fetches commands from `/api/commands`
3. Shows a filtered dropdown
4. On selection, inserts the command text into the chat input

- [ ] **Step 1: Create `web/src/session/chat/command-palette.js`**

```js
const COMMANDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function setupCommandPalette({
  chatInput,
  documentImpl = document,
  windowImpl = window,
  fetchImpl = fetch,
  sessionId = '',
} = {}) {
  if (!chatInput) return null;
  
  let commands = [];
  let commandsLoadedAt = 0;
  let palette = null;
  let selectedIndex = -1;
  let visible = false;

  async function loadCommands() {
    if (commands.length > 0 && Date.now() - commandsLoadedAt < COMMANDS_CACHE_TTL) return;
    try {
      const url = sessionId ? `/api/commands?id=${encodeURIComponent(sessionId)}` : '/api/commands';
      const res = await fetchImpl(url);
      if (!res.ok) return;
      const data = await res.json();
      commands = data.commands || [];
      commandsLoadedAt = Date.now();
    } catch (_) {
      // Silently fail — command palette is optional
    }
  }

  function createPalette() {
    if (palette) return palette;
    palette = documentImpl.createElement('div');
    palette.className = 'command-palette';
    palette.setAttribute('role', 'listbox');
    palette.style.display = 'none';
    chatInput.parentNode.insertBefore(palette, chatInput.nextSibling);
    return palette;
  }

  function showPalette(filter = '') {
    const p = createPalette();
    const filtered = filter
      ? commands.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.description.toLowerCase().includes(filter.toLowerCase()))
      : commands;
    
    if (filtered.length === 0 && filter) {
      p.style.display = 'none';
      visible = false;
      return;
    }
    
    p.innerHTML = '';
    filtered.forEach((cmd, i) => {
      const item = documentImpl.createElement('div');
      item.className = 'command-palette-item' + (i === selectedIndex ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.innerHTML = `<span class="command-palette-name">${escapeHtml(cmd.name)}</span><span class="command-palette-desc">${escapeHtml(cmd.description)}</span>`;
      item.addEventListener('click', () => selectCommand(cmd));
      item.addEventListener('mouseenter', () => {
        selectedIndex = i;
        updateSelection(p);
      });
      p.appendChild(item);
    });
    
    p.style.display = '';
    visible = true;
    selectedIndex = filtered.length > 0 ? 0 : -1;
    updateSelection(p);
  }

  function hidePalette() {
    if (palette) {
      palette.style.display = 'none';
    }
    visible = false;
    selectedIndex = -1;
  }

  function updateSelection(p) {
    const items = p.querySelectorAll('.command-palette-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
  }

  function selectCommand(cmd) {
    chatInput.value = cmd.name + ' ';
    chatInput.focus();
    hidePalette();
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  chatInput.addEventListener('input', async () => {
    const value = chatInput.value;
    if (value.startsWith('/')) {
      const filter = value.slice(1);
      await loadCommands();
      showPalette(filter);
    } else {
      hidePalette();
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (!visible) return;
    const items = palette.querySelectorAll('.command-palette-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(palette);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(palette);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        items[selectedIndex].click();
      }
    } else if (e.key === 'Escape') {
      hidePalette();
    }
  });

  documentImpl.addEventListener('click', (e) => {
    if (visible && palette && !palette.contains(e.target) && e.target !== chatInput) {
      hidePalette();
    }
  });

  return { hidePalette, loadCommands };
}
```

- [ ] **Step 2: Write test**

```js
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupCommandPalette } from './command-palette.js';

describe('command palette', () => {
  it('returns null without chatInput', () => {
    const result = setupCommandPalette({});
    expect(result).toBeNull();
  });

  it('shows palette when typing /', async () => {
    const dom = new JSDOM('<body><form><textarea id="chat"></textarea></form></body>', { url: 'https://example.test' });
    const chatInput = dom.window.document.getElementById('chat');
    const commands = [{ name: '/compact', description: 'Compact history' }];
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ commands }), { status: 200 })));
    setupCommandPalette({ chatInput, documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl, sessionId: 's1' });
    chatInput.value = '/';
    chatInput.dispatchEvent(new dom.window.Event('input'));
    await new Promise(r => setTimeout(r, 0));
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('selects command on Enter', async () => {
    const dom = new JSDOM('<body><form><textarea id="chat"></textarea></form></body>', { url: 'https://example.test' });
    const chatInput = dom.window.document.getElementById('chat');
    const commands = [{ name: '/compact', description: 'Compact history' }];
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ commands }), { status: 200 })));
    setupCommandPalette({ chatInput, documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl, sessionId: 's1' });
    chatInput.value = '/';
    chatInput.dispatchEvent(new dom.window.Event('input'));
    await new Promise(r => setTimeout(r, 0));
    expect(chatInput.value).toBe('/');
  });
});
```

- [ ] **Step 3: Run test**

```bash
cd D:/Workstation/pi-web/web && npx vitest run src/session/chat/command-palette.test.js
```

- [ ] **Step 4: Commit**

```bash
git add web/src/session/chat/command-palette.js web/src/session/chat/command-palette.test.js
git commit -m "feat: add command palette JS module for slash command autocomplete"
```

---

## Task 3: Wire command palette into chat composer

**Files:**
- Modify: `web/src/session/chat/chat-composer-runner.js`
- Modify: `web/src/session/chat/chat-composer-runner.test.js`

Import and call `setupCommandPalette` from the chat composer runner, passing the textarea element.

- [ ] **Step 1: Import and call `setupCommandPalette` in chat-composer-runner.js**

Add near top of file (after other imports):
```js
import { setupCommandPalette } from './command-palette.js';
```

In the `runChatComposer` function, after textarea is obtained, add:
```js
setupCommandPalette({
  chatInput: textarea,
  documentImpl,
  windowImpl,
  fetchImpl: __piChatApi.fetch || fetch,
  sessionId: textarea.form?.dataset.sessionId || '',
});
```

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
cd D:/Workstation/pi-web/web && npx vitest run src/session/chat/chat-composer-runner.test.js
```

- [ ] **Step 3: Commit**

```bash
git add web/src/session/chat/chat-composer-runner.js web/src/session/chat/chat-composer-runner.test.js
git commit -m "feat: wire command palette into chat composer"
```

---

## Task 4: Add command palette CSS styling

**Files:**
- Modify: `internal/ui/live_templates/styles/session.css`

Add styles for the command palette dropdown.

- [ ] **Step 1: Add CSS rules**

Add to the end of `session.css`:

```css
    .command-palette {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      max-height: 200px;
      overflow-y: auto;
      background: var(--card-bg);
      border: 1px solid var(--dim);
      border-radius: 4px;
      margin-bottom: 4px;
      z-index: 10;
    }

    .command-palette-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
    }

    .command-palette-item:hover,
    .command-palette-item.selected {
      background: color-mix(in srgb, var(--accent) 10%, var(--body-bg));
    }

    .command-palette-name {
      font-weight: bold;
      color: var(--text);
    }

    .command-palette-desc {
      color: var(--muted);
      font-size: 11px;
      margin-left: 12px;
    }
```

- [ ] **Step 2: Commit**

```bash
git add internal/ui/live_templates/styles/session.css
git commit -m "style: add command palette dropdown styling"
```

---

## Task 5: Integration test

- [ ] **Step 1: Build frontend**

```bash
cd D:/Workstation/pi-web/web && npm run build
```

- [ ] **Step 2: Build Go binary**

```bash
cd D:/Workstation/pi-web && go build -o pi-web.exe ./cmd/pi-web
```

- [ ] **Step 3: Manual test**

1. Start pi-web
2. In browser, type `/` in chat input
3. Command palette should appear
4. Filter by typing `/com` → should show `/compact`
5. Arrow keys navigate, Enter/Tab selects, Escape dismisses
6. Selected command fills chat input

- [ ] **Step 4: Final commit if fixes needed**