<script>
  let {
    sessionId = '',
    chatAvailable = true,
    chatDisabledReason = '',
    cwd = '',
    modelLabel = '',
  } = $props();
</script>

<form id="pi-chat-composer" class="pi-chat-composer" data-session-id={sessionId} data-chat-available={chatAvailable} data-chat-disabled-reason={chatDisabledReason}>
  <input id="pi-chat-images" name="images" type="file" accept="image/*" multiple hidden disabled={!chatAvailable}>
  <div class="pi-chat-shell">
    <button type="button" id="pi-chat-expand" class="pi-chat-expand-button" title="Expand composer" aria-label="Expand composer" aria-pressed="false" disabled={!chatAvailable}>⛶</button>
    {#if cwd}<div class="pi-chat-toolbar pi-chat-cwd-bar"><span class="pi-chat-cwd" title="Click to copy path" data-cwd={cwd}>cwd: {cwd}</span><span class="pi-chat-focus-shortcut">Shift + i to focus</span></div>{/if}
    {#if !chatAvailable}<div class="pi-chat-disabled-notice">{chatDisabledReason}</div>{/if}
    <textarea id="pi-chat-message" name="message" rows="1" placeholder="Continue this pi session…" disabled={!chatAvailable}></textarea>
    <div id="pi-chat-attachments" class="pi-chat-attachments"></div>
    <div id="pi-chat-model-popup" class="pi-chat-model-popup" style="display: none"><input type="text" id="pi-chat-model-search" class="pi-chat-model-search" placeholder="Search models…" autocomplete="off"><div id="pi-chat-model-list" class="pi-chat-model-list"></div></div>
    <div id="pi-chat-thinking-popup" class="pi-chat-thinking-popup" style="display: none"><div id="pi-chat-thinking-list" class="pi-chat-thinking-list"></div></div>
    <div id="pi-chat-slash-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-slash-list" class="pi-chat-slash-list"></div></div>
    <div id="pi-chat-mention-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-mention-list" class="pi-chat-slash-list"></div></div>
    <div class="pi-chat-toolbar"><div class="pi-chat-toolbar-left"><button type="button" id="pi-chat-attach" class="pi-chat-icon-button pi-chat-photo-button" title="Attach photos" aria-label="Attach photos" disabled={!chatAvailable}>▣</button><span id="pi-chat-status" class="pi-chat-status">{chatAvailable ? 'idle' : 'unavailable'}</span><button type="button" id="pi-chat-thinking-label" class="pi-chat-thinking-label" style="display: none" title="Switch effort" disabled={!chatAvailable}></button><button type="button" id="pi-chat-model-label" class="pi-chat-model-label" title="Switch model" style:display={modelLabel ? '' : 'none'} disabled={!chatAvailable}>{modelLabel}</button><div id="pi-chat-context-usage" class="pi-chat-context-usage" style="display: none" title="Click for details"><span class="pi-context-text">0%</span></div></div><div class="actions"><button type="button" id="pi-chat-cancel" class="pi-chat-cancel" style="display: none" title="Cancel running response" aria-label="Cancel running response" disabled={!chatAvailable}>Cancel</button><button type="submit" id="pi-chat-send" class="pi-chat-send" disabled>Send</button></div></div>
    <div id="pi-chat-context-popover" class="pi-chat-context-popover" style="display: none;"></div>
  </div>
  <div class="pi-git-bar" id="pi-git-bar" data-git-repo="false" data-git-branch="" data-git-default="false" data-git-has-changes="false"><div class="pi-git-branch" id="pi-git-branch" hidden><span class="pi-git-branch-name" id="pi-git-branch-name" title="Current branch"></span><button type="button" class="pi-git-edit" id="pi-git-branch-edit" title="Rename branch" aria-label="Rename branch"></button><input type="text" class="pi-git-branch-input" id="pi-git-branch-input" autocomplete="off" spellcheck="false" aria-label="New branch name" hidden></div><div class="pi-git-right"><button type="button" class="pi-git-pr-button pi-btw-button" id="pi-btw-button" title="btw">btw</button><div class="pi-git-pr" id="pi-git-pr" hidden><button type="button" class="pi-git-pr-button pi-git-primary" id="pi-git-primary"><span id="pi-git-primary-label">Create PR</span></button><button type="button" class="pi-git-pr-button pi-git-caret" id="pi-git-caret" aria-haspopup="true" aria-expanded="false" aria-label="More git actions"><span aria-hidden="true">▾</span></button><div class="pi-git-pr-menu" id="pi-git-pr-menu" role="menu" hidden><button type="button" class="pi-git-pr-item" id="pi-git-pr-view" role="menuitem" hidden>View PR ↗</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-draft" role="menuitem" hidden>Create Draft PR</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-manual" role="menuitem">Create PR manually ↗</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-merge" role="menuitem" hidden>Merge PR</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-commit" role="menuitem" hidden>Commit &amp; push</button></div></div></div></div>
</form>
