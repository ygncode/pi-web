// Write text to the clipboard, falling back to a hidden textarea + execCommand
// for insecure (HTTP) contexts where navigator.clipboard is unavailable.
// Returns true when the copy succeeded. DOM seams are injectable for tests.
export async function copyToClipboard(
  text,
  { documentImpl = document, navigatorImpl = navigator } = {},
) {
  try {
    if (navigatorImpl.clipboard && navigatorImpl.clipboard.writeText) {
      await navigatorImpl.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const ta = documentImpl.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.top = '0';
    ta.style.fontSize = '16px'; // avoid iOS zoom-on-focus
    ta.setAttribute('readonly', '');
    documentImpl.body.appendChild(ta);
    ta.select();
    // iOS Safari (and the home-screen app over plain http, where
    // navigator.clipboard is unavailable) needs an explicit selection range.
    try {
      ta.setSelectionRange(0, text.length);
    } catch {
      /* ignore */
    }
    const ok = documentImpl.execCommand('copy');
    documentImpl.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
