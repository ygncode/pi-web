# AskUserQuestion Multi-Select Bug Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix pi-web's AskUserQuestion rendering and interaction to correctly support `multiSelect: true` on individual questions.

**Architecture:** The `ask_user_question` tool sends a `questions` array where each question can have `multiSelect: true`. Pi-web currently ignores this field — single questions always send immediately on click, and multi-question cards use single-select (radio) behavior. The fix propagates `multiSelect` through rendering (`session-entry-renderer.js`, `live-renderer.js`) and interaction (`chat-composer-runner.js`), adding `data-multiple` attributes, toggle behavior, and multi-select answer collection.

**Tech Stack:** Vanilla JavaScript (no framework), Vitest for testing, JSDOM for test DOM, Go for embedded file checks.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `web/src/session/render/session-entry-renderer.js` | SSR/chunk rendering: emit `data-multiple` on question blocks, add `.ask-question-multiselect` class to options |
| `web/src/session/render/session-entry-renderer.test.js` | Tests for multi-select rendering in chunked/SSR mode |
| `web/src/session/live/live-renderer.js` | Live renderer: same `data-multiple` + multiselect class changes |
| `web/src/session/live/live-renderer.test.js` | Tests for live-renderer multi-select |
| `web/src/session/chat/chat-composer-runner.js` | Click handler: respect `data-multiple` for toggle + submit button; submit handler: collect multi-select answers |
| `web/src/session/chat/chat-composer-runner.test.js` | Tests for multi-select click and submit logic |
| `internal/ui/live_templates/styles/session.css` | Add `.ask-question-multiselect` visual style (dashed border, checkbox indicator) |
| `internal/ui/ask_user_question_render_test.go` | Add Go test checks for new `data-multiple` attribute and `multiselect` class |

---

## Task 1: session-entry-renderer.js — Render `data-multiple` attribute and multiselect class

**Files:**
- Modify: `web/src/session/render/session-entry-renderer.js:137,144-191`
- Test: `web/src/session/render/session-entry-renderer.test.js`

- [ ] **Step 1: Write the failing test**

Add to `web/src/session/render/session-entry-renderer.test.js`:

```js
it('renders data-multiple="true" on a question block when multiSelect is true', () => {
  const r = renderer();
  const html = r.renderEntry({
    id: 'q1',
    type: 'message',
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-1',
        name: 'ask_user_question',
        arguments: {
          questions: [{
            question: 'Pick frameworks',
            multiSelect: true,
            options: [
              { label: 'React' },
              { label: 'Vue' },
              { label: 'Svelte' }
            ]
          }]
        }
      }]
    }
  });
  expect(html).toContain('data-multiple="true"');
  expect(html).toContain('ask-question-multiselect');
});

it('renders data-multiple="false" by default when multiSelect is absent', () => {
  const r = renderer();
  const html = r.renderEntry({
    id: 'q1',
    type: 'message',
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-1',
        name: 'ask_user_question',
        arguments: {
          questions: [{ question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }] }]
        }
      }]
    }
  });
  expect(html).toContain('data-multiple="false"');
  expect(html).not.toContain('ask-question-multiselect');
});

it('shows submit button for single question with multiSelect', () => {
  const r = renderer();
  const html = r.renderEntry({
    id: 'q1',
    type: 'message',
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-1',
        name: 'ask_user_question',
        arguments: {
          questions: [{
            question: 'Pick many',
            multiSelect: true,
            options: [{ label: 'A' }, { label: 'B' }]
          }]
        }
      }]
    }
  });
  expect(html).toContain('ask-question-submit-btn');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Workstation/pi-web/web && npx vitest run src/session/render/session-entry-renderer.test.js`
Expected: 2 tests FAIL (no `data-multiple`, no `ask-question-multiselect` class), 1 test FAIL (no submit button for single multiSelect question)

- [ ] **Step 3: Modify `isMulti` logic and add `data-multiple` attribute**

In `web/src/session/render/session-entry-renderer.js`, change line 137:

```js
// BEFORE:
const isMulti = questions.length > 1;

// AFTER:
const isMulti = questions.length > 1 || questions.some(q => q.multiSelect);
```

Change the `ask-question-block` div at ~line 155 to include `data-multiple`:

```js
// BEFORE:
html += `<div class="ask-question-block" data-question-text="${escapeHtml(questionText)}">`;

// AFTER:
const qMultiple = q.multiSelect === true;
html += `<div class="ask-question-block" data-question-text="${escapeHtml(questionText)}" data-multiple="${qMultiple}">`;
```

Change the option rendering at ~line 170 to add `ask-question-multiselect` class when `qMultiple`:

```js
// BEFORE:
html += `<${tag} class="ask-question-option${selected ? ' selected' : ''}${actionClass}"${dataAttrs}>`;

// AFTER:
const multiSelectClass = qMultiple ? ' ask-question-multiselect' : '';
html += `<${tag} class="ask-question-option${selected ? ' selected' : ''}${actionClass}${multiSelectClass}"${dataAttrs}>`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/Workstation/pi-web/web && npx vitest run src/session/render/session-entry-renderer.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd D:/Workstation/pi-web
git add web/src/session/render/session-entry-renderer.js web/src/session/render/session-entry-renderer.test.js
git commit -m "fix: render data-multiple and ask-question-multiselect in AskUserQuestion"
```

---

## Task 2: live-renderer.js — Same `data-multiple` and multiselect changes for live mode

**Files:**
- Modify: `web/src/session/live/live-renderer.js:131-170`
- Test: `web/src/session/live/live-renderer.test.js`

- [ ] **Step 1: Write the failing test**

Add to `web/src/session/live/live-renderer.test.js`:

```js
it('renders data-multiple="true" when multiSelect is true', () => {
  const dom = new JSDOM('<body></body>');
  const renderer = createLiveRenderer({ documentImpl: dom.window.document, markedImpl: marked });
  const html = renderer.renderEntry({
    id: 'q1',
    type: 'message',
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'call-1',
        name: 'ask_user_question',
        arguments: {
          questions: [{
            question: 'Pick many',
            multiSelect: true,
            options: [{ label: 'A' }, { label: 'B' }]
          }]
        }
      }]
    }
  }, []);
  expect(html).toContain('data-multiple="true"');
  expect(html).toContain('ask-question-multiselect');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Workstation/pi-web/web && npx vitest run src/session/live/live-renderer.test.js`
Expected: FAIL — `data-multiple` and `ask-question-multiselect` not found

- [ ] **Step 3: Modify live-renderer.js**

In `web/src/session/live/live-renderer.js`, change the `qaMulti` line (~137):

```js
// BEFORE:
var qaMulti = questions.length > 1;

// AFTER:
var qaMulti = questions.length > 1 || questions.some(function(q) { return q.multiSelect === true; });
```

Change the `ask-question-block` div to include `data-multiple`:

```js
// BEFORE:
html += '<div class="ask-question-block" data-question-text="'+escapeHtml(questionText)+'">';

// AFTER:
var qMultiple = q.multiSelect === true;
html += '<div class="ask-question-block" data-question-text="'+escapeHtml(questionText)+'" data-multiple="'+qMultiple+'">';
```

Change the option class to include `ask-question-multiselect`:

```js
// BEFORE:
var cls = 'ask-question-option'+(sel?' selected':'')+(qaInteractive?' ask-question-option-action':'');

// AFTER:
var multiCls = qMultiple ? ' ask-question-multiselect' : '';
var cls = 'ask-question-option'+(sel?' selected':'')+(qaInteractive?' ask-question-option-action':'')+multiCls;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/Workstation/pi-web/web && npx vitest run src/session/live/live-renderer.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd D:/Workstation/pi-web
git add web/src/session/live/live-renderer.js web/src/session/live/live-renderer.test.js
git commit -m "fix: render data-multiple and multiselect class in live renderer"
```

---

## Task 3: chat-composer-runner.js — Multi-select click and submit logic

**Files:**
- Modify: `web/src/session/chat/chat-composer-runner.js:496-517`
- Test: `web/src/session/chat/chat-composer-runner.test.js`

- [ ] **Step 1: Write the failing test**

Add to `web/src/session/chat/chat-composer-runner.test.js`:

```js
describe('AskUserQuestion multiSelect', () => {
  it('toggles selection on multi-select option click instead of sending immediately', () => {
    const html = `
      <div class="ask-question-card" data-question-count="1">
        <div class="ask-question-block" data-question-text="Pick many" data-multiple="true">
          <div class="ask-question-options">
            <button class="ask-question-option ask-question-option-action ask-question-multiselect" type="button" data-question="Pick many" data-answer="A">A</button>
            <button class="ask-question-option ask-question-option-action ask-question-multiselect" type="button" data-question="Pick many" data-answer="B">B</button>
          </div>
        </div>
        <div class="ask-question-actions" style="display:none"><button type="button" class="ask-question-submit-btn">Send answers</button></div>
      </div>
      <form id="pi-chat-composer" data-chat-available="true" data-session-id="s1">
        <div class="pi-chat-shell">
          <textarea id="pi-chat-message"></textarea>
          <input id="pi-chat-images"><button id="pi-chat-attach"></button>
          <div id="pi-chat-attachments"></div>
          <button id="pi-chat-cancel" style="display:none"></button>
          <button id="pi-chat-send"></button><span id="pi-chat-status"></span>
        </div>
      </form>`;
    const dom = new JSDOM(html, { url: 'https://example.test' });
    const sendChatMessage = vi.fn(async () => true);
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: {},
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {},
      thinkingSelector: {},
      sendChatMessage
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    const optA = dom.window.document.querySelector('[data-answer="A"]');
    optA.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    // Should toggle, not send immediately
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(optA.classList.contains('selected')).toBe(true);
    // Click again to deselect
    optA.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(optA.classList.contains('selected')).toBe(false);
  });

  it('collects multi-select answers with comma-separated values', () => {
    const html = `
      <div class="ask-question-card" data-question-count="1">
        <div class="ask-question-block" data-question-text="Pick many" data-multiple="true">
          <div class="ask-question-options">
            <button class="ask-question-option ask-question-option-action ask-question-multiselect selected" type="button" data-question="Pick many" data-answer="React">React</button>
            <button class="ask-question-option ask-question-option-action ask-question-multiselect selected" type="button" data-question="Pick many" data-answer="Vue">Vue</button>
            <button class="ask-question-option ask-question-option-action ask-question-multiselect" type="button" data-question="Pick many" data-answer="Svelte">Svelte</button>
          </div>
        </div>
        <div class="ask-question-actions"><button type="button" class="ask-question-submit-btn">Send answers</button></div>
      </div>
      <form id="pi-chat-composer" data-chat-available="true" data-session-id="s1">
        <div class="pi-chat-shell">
          <textarea id="pi-chat-message"></textarea>
          <input id="pi-chat-images"><button id="pi-chat-attach"></button>
          <div id="pi-chat-attachments"></div>
          <button id="pi-chat-cancel" style="display:none"></button>
          <button id="pi-chat-send"></button><span id="pi-chat-status"></span>
        </div>
      </form>`;
    const dom = new JSDOM(html, { url: 'https://example.test' });
    const sendChatMessage = vi.fn(async () => true);
    runChatComposer({
      documentImpl: dom.window.document,
      windowImpl: dom.window,
      chatApi: {},
      chatSelectors: { THINKING_LEVELS: [] },
      modelSelector: {},
      thinkingSelector: {},
      sendChatMessage
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    const submitBtn = dom.window.document.querySelector('.ask-question-submit-btn');
    submitBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    // Should send comma-separated answers
    expect(sendChatMessage).toHaveBeenCalledWith('"Pick many" = "React, Vue"', []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Workstation/pi-web/web && npx vitest run src/session/chat/chat-composer-runner.test.js`
Expected: FAIL — multi-select click sends immediately instead of toggling; submit doesn't collect multi-select

- [ ] **Step 3: Update click handler for multi-select toggle behavior**

In `web/src/session/chat/chat-composer-runner.js`, replace the single-question immediate-send block (around line 496-507):

```js
// BEFORE:
if (questionCount === 1) {
  // Single question: send immediately
  const question = option.dataset.question || 'Question';
  const answer = option.dataset.answer || option.textContent.trim();
  option.disabled = true;
  const sent = await sendChatMessage(`"${question}" = "${answer}"`, []);
  if (!sent) option.disabled = false;
  return;
}

// Multi-question: mark selection, show submit button
if (block) {
  block.querySelectorAll('.ask-question-option-action').forEach(b => b.classList.remove('selected'));
  option.classList.add('selected');
}

// AFTER:
const qMultiple = block?.dataset.multiple === 'true';

if (questionCount === 1 && !qMultiple) {
  // Single question, single select: send immediately
  const question = option.dataset.question || 'Question';
  const answer = option.dataset.answer || option.textContent.trim();
  option.disabled = true;
  const sent = await sendChatMessage(`"${question}" = "${answer}"`, []);
  if (!sent) option.disabled = false;
  return;
}

// Multi-question or multi-select: toggle selection
if (qMultiple) {
  option.classList.toggle('selected');
} else if (block) {
  block.querySelectorAll('.ask-question-option-action').forEach(b => b.classList.remove('selected'));
  option.classList.add('selected');
}
```

- [ ] **Step 4: Update submit handler for multi-select answer collection**

In the submit button handler (~line 473-479), change the answer collection logic:

```js
// BEFORE:
card.querySelectorAll('.ask-question-block').forEach(block => {
  const questionText = block.dataset.questionText || '';
  const sel = block.querySelector('.ask-question-option-action.selected');
  if (sel && questionText) parts.push(`"${questionText}" = "${sel.dataset.answer || ''}"`);
});

// AFTER:
card.querySelectorAll('.ask-question-block').forEach(block => {
  const questionText = block.dataset.questionText || '';
  const blockMultiple = block.dataset.multiple === 'true';
  if (blockMultiple) {
    const selected = block.querySelectorAll('.ask-question-option-action.selected');
    const answers = Array.from(selected).map(sel => sel.dataset.answer || '');
    if (answers.length > 0 && questionText) {
      parts.push(`"${questionText}" = "${answers.join(', ')}"`);
    }
  } else {
    const sel = block.querySelector('.ask-question-option-action.selected');
    if (sel && questionText) parts.push(`"${questionText}" = "${sel.dataset.answer || ''}"`);
  }
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/Workstation/pi-web/web && npx vitest run src/session/chat/chat-composer-runner.test.js`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd D:/Workstation/pi-web
git add web/src/session/chat/chat-composer-runner.js web/src/session/chat/chat-composer-runner.test.js
git commit -m "fix: support multiSelect toggle and comma-separated answers in AskUserQuestion"
```

---

## Task 4: CSS — Add `.ask-question-multiselect` visual style

**Files:**
- Modify: `internal/ui/live_templates/styles/session.css`

- [ ] **Step 1: Add CSS rule for multi-select option style**

Add after the `.ask-question-option.selected` rule (~line 961) in `internal/ui/live_templates/styles/session.css`:

```css
.ask-question-option.multiselect {
  cursor: pointer;
  border-style: dashed;
}

.ask-question-option.multiselect.selected::before {
  content: '☑ ';
  color: var(--accent);
}

.ask-question-option.multiselect:not(.selected)::before {
  content: '☐ ';
  color: var(--dim);
}
```

- [ ] **Step 2: Verify CSS is included in Go tests**

Run: `cd D:/Workstation/pi-web && go test ./internal/ui/ -run TestAskUserQuestion -v`
Expected: PASS — the Go test checks that `ask-question-option` exists in the embedded CSS, which still passes since we only added a new class variant.

- [ ] **Step 3: Commit**

```bash
cd D:/Workstation/pi-web
git add internal/ui/live_templates/styles/session.css
git commit -m "style: add multiselect visual style for AskUserQuestion options"
```

---

## Task 5: Go embedded-asset test — Add `data-multiple` check

**Files:**
- Modify: `internal/ui/ask_user_question_render_test.go`

- [ ] **Step 1: Add check for `data-multiple` and `multiselect` class**

In `internal/ui/ask_user_question_render_test.go`, add to the `TestAskUserQuestionToolHasDedicatedRenderer` checks slice:

```go
checks := []string{
    "case 'ask_user_question':",
    "renderAskUserQuestionTool(args, result)",
    "ask-question-card",
    "ask-question-option",
    "data-multiple",
    "ask-question-multiselect",
}
```

- [ ] **Step 2: Run Go test to verify**

Run: `cd D:/Workstation/pi-web && go test ./internal/ui/ -run TestAskUserQuestion -v`
Expected: PASS (the embedded JS now contains both `data-multiple` and `ask-question-multiselect`)

- [ ] **Step 3: Commit**

```bash
cd D:/Workstation/pi-web
git add internal/ui/ask_user_question_render_test.go
git commit -m "test: add data-multiple and multiselect class checks to Go embedded asset test"
```

---

## Task 6: Manual integration test

**Files:** None (manual verification)

- [ ] **Step 1: Build frontend assets**

Run: `cd D:/Workstation/pi-web/web && npm run build`
Expected: Build succeeds

- [ ] **Step 2: Rebuild Go binary (embeds frontend assets)**

Run: `cd D:/Workstation/pi-web && go build -o pi-web.exe ./cmd/pi-web`
Expected: Build succeeds

- [ ] **Step 3: Manual test with pi — trigger a multiSelect AskUserQuestion**

1. Start pi-web: `./pi-web.exe`
2. In a pi terminal session, trigger an `ask_user_question` with `multiSelect: true`:

   Use the `ask_user_question` tool with a question like:
   ```json
   {
     "questions": [{
       "question": "Which frameworks?",
       "multiSelect": true,
       "options": [
         {"label": "React"},
         {"label": "Vue"},
         {"label": "Svelte"}
       ]
     }]
   }
   ```

4. In the pi-web browser:
   - Verify options show `☐` checkboxes (dashed border)
   - Click an option → toggles selected with `☑` (not immediate send)
   - Click again → deselects
   - Multiple options can be selected
   - Click "Send answers" → sends `"Which frameworks?" = "React, Vue"` format
   - Single-question without multiSelect still sends immediately on click

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration test adjustments for AskUserQuestion multiSelect"
```