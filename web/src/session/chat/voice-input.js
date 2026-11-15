// Voice input for the composer: record with MediaRecorder and transcribe on the
// hub's local Whisper (/api/transcribe); fall back to the browser Web Speech API
// when the server is unavailable. getUserMedia needs a secure context (https or
// localhost) — on plain-http tailnet URLs iOS exposes no microphone at all.

export function voiceSupport(win = globalThis) {
  const secure = !!win.isSecureContext;
  const recorder = !!(secure && win.navigator?.mediaDevices?.getUserMedia && win.MediaRecorder);
  const Speech = win.SpeechRecognition || win.webkitSpeechRecognition;
  return { secure, recorder, speech: !!(secure && Speech) };
}

const MIME_PREFS = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];

export function pickMimeType(MR = globalThis.MediaRecorder) {
  if (!MR?.isTypeSupported) return '';
  return MIME_PREFS.find((t) => MR.isTypeSupported(t)) || '';
}

// insertTranscript appends text to the textarea (space-separated) and fires
// `input` so the composer's autosize / state listeners update.
export function insertTranscript(textarea, text) {
  const t = String(text || '').trim();
  if (!textarea || !t) return false;
  const cur = textarea.value || '';
  textarea.value = cur && !/\s$/.test(cur) ? cur + ' ' + t : cur + t;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  try {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  } catch {
    /* ignore */
  }
  return true;
}

export async function serverAvailable(fetchImpl = fetch) {
  try {
    const r = await fetchImpl('/api/transcribe', { headers: { Accept: 'application/json' } });
    if (!r.ok) return false;
    return !!(await r.json())?.available;
  } catch {
    return false;
  }
}

export async function transcribeBlob(blob, { language = 'auto', fetchImpl = fetch } = {}) {
  const r = await fetchImpl('/api/transcribe?language=' + encodeURIComponent(language), {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

// startRecording resolves to a controller whose stop() resolves to the Blob.
export async function startRecording(win = globalThis) {
  const stream = await win.navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType(win.MediaRecorder);
  const rec = new win.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  rec.start(250);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' }));
        };
        rec.stop();
      }),
    cancel: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      release();
    },
  };
}

// startSpeech uses the browser's speech recognition (pt-BR) as a fallback.
export function startSpeech(onText, win = globalThis, lang = 'pt-BR') {
  const Speech = win.SpeechRecognition || win.webkitSpeechRecognition;
  const r = new Speech();
  r.lang = lang;
  r.interimResults = false;
  r.continuous = true;
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) onText(e.results[i][0].transcript);
    }
  };
  r.start();
  return { stop: () => r.stop() };
}
