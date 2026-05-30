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

  let commandsLoading = null;

  function loadCommands() {
    if (commands.length > 0 && Date.now() - commandsLoadedAt < COMMANDS_CACHE_TTL) return Promise.resolve();
    if (commandsLoading) return commandsLoading;

    commandsLoading = (async () => {
      try {
        const url = sessionId ? `/api/commands?id=${encodeURIComponent(sessionId)}` : '/api/commands';
        const res = await fetchImpl(url);
        if (!res.ok) return;
        const data = await res.json();
        commands = data.commands || [];
        commandsLoadedAt = Date.now();
      } catch (_) {
        // Silently fail
      } finally {
        commandsLoading = null;
      }
    })();
    return commandsLoading;
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function createPalette() {
    if (palette) return palette;
    palette = documentImpl.createElement('div');
    palette.className = 'pi-command-suggestions';
    palette.setAttribute('role', 'listbox');
    documentImpl.body.appendChild(palette); // Move to body to escape parent stacking context
    return palette;
  }

  function updatePosition() {
    if (!palette || !chatInput) return;
    const rect = chatInput.getBoundingClientRect();
    const win = documentImpl.defaultView || windowImpl;
    // Position fixed to overlay everything
    palette.style.position = 'fixed';
    palette.style.left = rect.left + 'px';
    palette.style.width = rect.width + 'px';
    const bottomGap = (win.innerHeight - rect.top) + 8;
    palette.style.bottom = bottomGap + 'px';
    palette.style.top = 'auto'; // Ensure it grows upwards
  }

  function removePalette() {
    if (palette && palette.parentNode) {
      palette.parentNode.removeChild(palette);
    }
    palette = null;
    visible = false;
    selectedIndex = -1;
  }

  function updateSelection(p) {
    const items = p.querySelectorAll('.pi-command-suggestion-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
  }

  function showPalette(filter = '') {
    const p = createPalette();
    const filtered = filter
      ? commands.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.description.toLowerCase().includes(filter.toLowerCase()))
      : commands;

    if (filtered.length === 0) {
      hidePalette();
      return;
    }

    p.innerHTML = '';
    filtered.forEach((cmd, i) => {
      const item = documentImpl.createElement('div');
      item.className = 'pi-command-suggestion-item' + (i === 0 ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.innerHTML = '<span class="pi-command-suggestion-name">' + escapeHtml(cmd.name) + '</span><span class="pi-command-suggestion-desc">' + escapeHtml(cmd.description) + '</span>';
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        selectCommand(cmd);
      });
      p.appendChild(item);
    });

    selectedIndex = 0;
    p.style.display = 'block';
    visible = true;
    updatePosition(); // Recalculate position
  }

  function hidePalette() {
    if (palette) {
      palette.style.display = 'none';
    }
    visible = false;
    selectedIndex = -1;
  }

  function selectCommand(cmd) {
    chatInput.value = cmd.name + ' ';
    chatInput.focus();
    chatInput.dispatchEvent(new (documentImpl.defaultView || windowImpl).Event('input', { bubbles: true }));
    hidePalette();
  }

  async function handleInput() {
    const value = chatInput.value || '';
    if (value === '/') {
      await loadCommands();
      showPalette('');
    } else if (value.startsWith('/')) {
      const filter = value.slice(1);
      showPalette(filter);
    } else {
      hidePalette();
    }
  }

  function handleKeydown(e) {
    if (!visible || !palette) return;

    const items = palette.querySelectorAll('.pi-command-suggestion-item');
    if (items.length === 0) return;

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
        const name = items[selectedIndex].querySelector('.pi-command-suggestion-name').textContent;
        const cmd = commands.find(c => c.name === name) || { name };
        selectCommand(cmd);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hidePalette();
    }
  }

  // Load commands eagerly so the palette is ready
  loadCommands();

  chatInput.addEventListener('input', handleInput);
  chatInput.addEventListener('keydown', handleKeydown);
  chatInput.addEventListener('blur', () => {
    // Small delay to allow click events on palette items
    setTimeout(hidePalette, 150);
  });
  chatInput.addEventListener('focus', () => {
    if (chatInput.value.startsWith('/')) {
      handleInput();
    }
  });

  return { hidePalette, loadCommands, removePalette };
}