// ============================================================
// DATA LOADING
// ============================================================

const base64 = document.getElementById('session-data').textContent;
const binary = atob(base64);
const bytes = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) {
  bytes[i] = binary.charCodeAt(i);
}
const data = JSON.parse(new TextDecoder('utf-8').decode(bytes));
const { header, entries, leafId: defaultLeafId, systemPrompt, tools, renderedTools } = data;

// ============================================================
// URL PARAMETER HANDLING
// ============================================================

// Parse URL parameters for deep linking: leafId and targetId
// Check for injected params (when loaded in iframe via srcdoc) or use window.location
const injectedParams = document.querySelector('meta[name="pi-url-params"]');
const searchString = injectedParams ? injectedParams.content : window.location.search.substring(1);
const urlParams = new URLSearchParams(searchString);
const urlLeafId = urlParams.get('leafId');
const urlTargetId = urlParams.get('targetId');
// Use URL leafId if provided, otherwise fall back to session default
const leafId = urlLeafId || defaultLeafId;

// ============================================================
// DATA STRUCTURES
// ============================================================

// Entry lookup by ID
const byId = new Map();
for (const entry of entries) {
  byId.set(entry.id, entry);
}

// Tool call lookup (toolCallId -> {name, arguments})
const toolCallMap = new Map();
for (const entry of entries) {
  if (entry.type === 'message' && entry.message.role === 'assistant') {
    const content = entry.message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'toolCall') {
          toolCallMap.set(block.id, { name: block.name, arguments: block.arguments });
        }
      }
    }
  }
}

// Label lookup (entryId -> label string)
// Labels are stored in 'label' entries that reference their target via targetId
const labelMap = new Map();
for (const entry of entries) {
  if (entry.type === 'label' && entry.targetId && entry.label) {
    labelMap.set(entry.targetId, entry.label);
  }
}
