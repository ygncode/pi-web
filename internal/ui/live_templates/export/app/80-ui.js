// ============================================================
// INITIALIZATION
// ============================================================

// Configure marked with syntax highlighting and TUI-compatible HTML handling
const strictStrikethroughRegex = /^(~~)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/;

marked.use({
  breaks: true,
  gfm: true,
  tokenizer: {
    // Treat HTML-like input as plain text so tags are shown verbatim,
    // matching the TUI markdown renderer.
    html() {
      return undefined;
    },
    tag() {
      return undefined;
    },
    del(src) {
      const match = strictStrikethroughRegex.exec(src);
      if (!match) return undefined;
      return {
        type: 'del',
        raw: match[0],
        text: match[2],
        tokens: this.lexer.inlineTokens(match[2])
      };
    }
  },
  renderer: {
    // Sanitize link URLs to prevent javascript:/vbscript:/data: XSS
    link(token) {
      const href = (token.href || '').trim();
      if (/^\s*(javascript|vbscript|data):/i.test(href)) {
        return this.parser.parseInline(token.tokens);
      }
      let out = '<a href="' + escapeHtml(href) + '"';
      if (token.title) {
        out += ' title="' + escapeHtml(token.title) + '"';
      }
      out += '>' + this.parser.parseInline(token.tokens) + '</a>';
      return out;
    },
    // Sanitize image src URLs
    image(token) {
      const href = (token.href || '').trim();
      if (/^\s*(javascript|vbscript|data):/i.test(href)) {
        return escapeHtml(token.text || '');
      }
      let out = '<img src="' + escapeHtml(href) + '" alt="' + escapeHtml(token.text || '') + '"';
      if (token.title) {
        out += ' title="' + escapeHtml(token.title) + '"';
      }
      out += '>';
      return out;
    },
    // Code blocks: syntax highlight, no HTML escaping
    code(token) {
      const code = token.text;
      const lang = token.lang;
      let highlighted;
      if (lang && hljs.getLanguage(lang)) {
        try {
          highlighted = hljs.highlight(code, { language: lang }).value;
        } catch {
          highlighted = escapeHtml(code);
        }
      } else {
        // Auto-detect language if not specified
        try {
          highlighted = hljs.highlightAuto(code).value;
        } catch {
          highlighted = escapeHtml(code);
        }
      }
      return `<pre><code class="hljs">${highlighted}</code></pre>`;
    },
    // Inline code: escape HTML
    codespan(token) {
      return `<code>${escapeHtml(token.text)}</code>`;
    }
  }
});

// Simple marked parse (escaping handled in renderers)
function safeMarkedParse(text) {
  return marked.parse(text);
}

// Search input
const searchInput = document.getElementById('tree-search');
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  forceTreeRerender();
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterMode = btn.dataset.filter;
    forceTreeRerender();
  });
});

// Sidebar toggle
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const hamburger = document.getElementById('hamburger');
const sidebarResizer = document.getElementById('sidebar-resizer');
const SIDEBAR_WIDTH_STORAGE_KEY = 'pi-share:v1:sidebar-width';
const MIN_CONTENT_WIDTH = 320;

function isMobileLayout() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(max-width: 900px)').matches;
}

function getSidebarBounds() {
  const rootStyles = getComputedStyle(document.documentElement);
  const minWidth = parseFloat(rootStyles.getPropertyValue('--sidebar-min-width')) || 240;
  const maxWidth = parseFloat(rootStyles.getPropertyValue('--sidebar-max-width')) || 720;
  const viewportMaxWidth = window.innerWidth - MIN_CONTENT_WIDTH;
  return {
    minWidth,
    maxWidth: Math.max(minWidth, Math.min(maxWidth, viewportMaxWidth))
  };
}

function clampSidebarWidth(width) {
  const { minWidth, maxWidth } = getSidebarBounds();
  return Math.max(minWidth, Math.min(maxWidth, width));
}

function applySidebarWidth(width) {
  document.documentElement.style.setProperty('--sidebar-width', `${Math.round(clampSidebarWidth(width))}px`);
}

function loadSidebarWidth() {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw === null) return null;
    const width = Number(raw);
    return Number.isFinite(width) ? width : null;
  } catch {
    return null;
  }
}

function saveSidebarWidth(width) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(clampSidebarWidth(width))));
  } catch {
    // Ignore storage failures (e.g. private browsing restrictions)
  }
}

function setupSidebarResize() {
  const savedWidth = loadSidebarWidth();
  if (savedWidth !== null) {
    applySidebarWidth(savedWidth);
  }

  if (!sidebarResizer) return;

  let cleanupDrag = null;

  const stopDrag = (pointerId) => {
    if (cleanupDrag) {
      cleanupDrag(pointerId);
      cleanupDrag = null;
    }
  };

  sidebarResizer.addEventListener('pointerdown', (e) => {
    if (isMobileLayout()) return;

    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;
    document.body.classList.add('sidebar-resizing');
    sidebarResizer.setPointerCapture?.(e.pointerId);

    const onPointerMove = (event) => {
      applySidebarWidth(startWidth + (event.clientX - startX));
    };

    cleanupDrag = (pointerIdToRelease) => {
      document.body.classList.remove('sidebar-resizing');
      sidebarResizer.releasePointerCapture?.(pointerIdToRelease);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      saveSidebarWidth(sidebar.getBoundingClientRect().width);
    };

    const onPointerUp = (event) => stopDrag(event.pointerId);
    const onPointerCancel = (event) => stopDrag(event.pointerId);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  });

  sidebarResizer.addEventListener('dblclick', () => {
    if (isMobileLayout()) return;
    applySidebarWidth(400);
    saveSidebarWidth(400);
  });

  window.addEventListener('resize', () => {
    if (isMobileLayout()) {
      document.body.classList.remove('sidebar-collapsed');
      hamburger.style.display = '';
      return;
    }
    applySidebarWidth(sidebar.getBoundingClientRect().width);
    const collapsed = loadSidebarCollapsed();
    setSidebarCollapsed(collapsed);
  });
}

setupSidebarResize();

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'pi-share:v1:sidebar-collapsed';

function loadSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {}
}

function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  if (isMobileLayout()) {
    hamburger.style.display = '';
  } else {
    hamburger.style.display = collapsed ? '' : 'none';
  }
}

function setSidebarOpen(open) {
  sidebar.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
  document.body.classList.toggle('sidebar-open', open);
  hamburger.style.display = open ? 'none' : '';
}

function setupSidebarCollapse() {
  const collapsed = loadSidebarCollapsed();
  if (!isMobileLayout()) {
    setSidebarCollapsed(collapsed);
  }

  hamburger.addEventListener('click', () => {
    if (isMobileLayout()) {
      setSidebarOpen(true);
      return;
    }
    setSidebarCollapsed(false);
    saveSidebarCollapsed(false);
  });

  const closeSidebar = () => {
    if (isMobileLayout()) {
      setSidebarOpen(false);
      return;
    }
    setSidebarCollapsed(true);
    saveSidebarCollapsed(true);
  };

  overlay.addEventListener('click', closeSidebar);
  overlay.addEventListener('touchstart', (e) => {
    e.preventDefault();
    closeSidebar();
  }, { passive: false });

  const hideSidebarBtn = document.getElementById('hide-sidebar');
  if (hideSidebarBtn) {
    hideSidebarBtn.addEventListener('click', closeSidebar);
  }
}

setupSidebarCollapse();

// Toggle states
const TOGGLE_STATE_STORAGE_KEY = 'pi.sessionDetail.toggleState';
const toggleStateDefaults = { thinkingExpanded: true, toolsVisible: true, toolOutputsExpanded: false };
let toggleState = { ...toggleStateDefaults };

try {
  const savedToggleState = JSON.parse(localStorage.getItem(TOGGLE_STATE_STORAGE_KEY) || '{}');
  if (typeof savedToggleState.thinkingExpanded === 'boolean') toggleState.thinkingExpanded = savedToggleState.thinkingExpanded;
  if (typeof savedToggleState.toolsVisible === 'boolean') toggleState.toolsVisible = savedToggleState.toolsVisible;
  if (typeof savedToggleState.toolOutputsExpanded === 'boolean') toggleState.toolOutputsExpanded = savedToggleState.toolOutputsExpanded;
} catch (_) {}

const saveToggleState = () => {
  try {
    localStorage.setItem(TOGGLE_STATE_STORAGE_KEY, JSON.stringify(toggleState));
  } catch (_) {}
};

const applyThinkingState = (root) => {
  root.querySelectorAll('.thinking-text').forEach(el => {
    el.style.display = toggleState.thinkingExpanded ? '' : 'none';
  });
  root.querySelectorAll('.thinking-collapsed').forEach(el => {
    el.style.display = toggleState.thinkingExpanded ? 'none' : 'block';
  });
};

const applyToolsVisibilityState = (root) => {
  root.querySelectorAll('.tool-execution, .compaction').forEach(el => {
    el.style.display = toggleState.toolsVisible ? '' : 'none';
  });
};

const applyToolOutputState = (root) => {
  root.querySelectorAll('.tool-output.expandable').forEach(el => {
    el.classList.toggle('expanded', toggleState.toolOutputsExpanded);
  });
  root.querySelectorAll('.compaction').forEach(el => {
    el.classList.toggle('expanded', toggleState.toolOutputsExpanded);
  });
};

const syncToggleButtons = () => {
  const buttons = [
    [document.querySelector('[data-action="toggle-thinking"]'), toggleState.thinkingExpanded],
    [document.querySelector('[data-action="toggle-tools"]'), toggleState.toolsVisible],
    [document.querySelector('[data-action="toggle-tool-output"]'), toggleState.toolOutputsExpanded],
  ];
  buttons.forEach(([btn, isActive]) => {
    if (!btn) return;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

window.sessionToggleState = {
  get thinkingExpanded() { return toggleState.thinkingExpanded; },
  get toolsVisible() { return toggleState.toolsVisible; },
  get toolOutputsExpanded() { return toggleState.toolOutputsExpanded; },
  applyToNode(node) {
    if (!node) return;
    applyThinkingState(node);
    applyToolsVisibilityState(node);
    applyToolOutputState(node);
  },
  syncButtons: syncToggleButtons,
};

const toggleThinking = () => {
  toggleState.thinkingExpanded = !toggleState.thinkingExpanded;
  saveToggleState();
  window.sessionToggleState.applyToNode(document);
  syncToggleButtons();
};

const toggleToolsVisibility = () => {
  toggleState.toolsVisible = !toggleState.toolsVisible;
  saveToggleState();
  window.sessionToggleState.applyToNode(document);
  syncToggleButtons();
};

const toggleToolOutputs = () => {
  toggleState.toolOutputsExpanded = !toggleState.toolOutputsExpanded;
  saveToggleState();
  window.sessionToggleState.applyToNode(document);
  syncToggleButtons();
};

window.applyToggleStateToNode = (node) => window.sessionToggleState.applyToNode(node);

const attachHeaderHandlers = () => {
  document.querySelector('[data-action="toggle-thinking"]')?.addEventListener('click', toggleThinking);
  document.querySelector('[data-action="toggle-tools"]')?.addEventListener('click', toggleToolsVisibility);
  document.querySelector('[data-action="toggle-tool-output"]')?.addEventListener('click', toggleToolOutputs);
  syncToggleButtons();
};

const isEditableTarget = (element) => {
  if (!element) return false;
  const tagName = element.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
    return true;
  }
  return element.isContentEditable || Boolean(element.closest?.('[contenteditable="true"]'));
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    searchQuery = '';
    navigateTo(leafId, 'bottom');
  }

  if (isEditableTarget(document.activeElement)) {
    return;
  }

  const key = e.key.toLowerCase();
  if (key === 't') {
    e.preventDefault();
    toggleThinking();
  } else if (key === 'o') {
    e.preventDefault();
    toggleToolsVisibility();
  } else if (key === 'p') {
    e.preventDefault();
    toggleToolOutputs();
  }
});

// ============================================================
// INITIAL RENDER
// ============================================================

// If URL has targetId, scroll to that specific message; otherwise stay at top
if (leafId) {
  if (urlTargetId && byId.has(urlTargetId)) {
    // Deep link: navigate to leaf and scroll to target message
    navigateTo(leafId, 'target', urlTargetId);
  } else {
    navigateTo(leafId, 'none');
  }
} else if (entries.length > 0) {
  // Fallback: use last entry if no leafId
  navigateTo(entries[entries.length - 1].id, 'none');
}
