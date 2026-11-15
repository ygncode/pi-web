<script>
  // Composer mic: tap to record, tap again to transcribe into the input box
  // (local Whisper on the hub; Web Speech fallback). The user reviews and sends.
  import { icon, Mic, MicOff, Loader } from '../../../shared/icons.js';
  import { showToast } from '../../../shared/toast.js';
  import {
    voiceSupport,
    serverAvailable,
    startRecording,
    transcribeBlob,
    startSpeech,
    insertTranscript,
  } from '../../../session/chat/voice-input.js';

  let {
    disabled = false,
    win = globalThis,
    checkServer = serverAvailable,
    record = startRecording,
    transcribe = transcribeBlob,
    speech = startSpeech,
  } = $props();

  let state = $state('idle'); // idle | recording | listening | busy
  let ctl = null;
  const support = voiceSupport(win);

  const textarea = () => win.document?.getElementById('pi-chat-message');
  const toast = (msg) => showToast(msg, { id: 'voice-toast', duration: 3500 });

  async function onClick() {
    if (state === 'recording') return finishRecording();
    if (state === 'listening') {
      ctl?.stop();
      state = 'idle';
      return;
    }
    if (state !== 'idle') return;
    if (!support.secure) {
      toast('Microfone só funciona no endereço https (ex.: https://strategy-c.tail40db1.ts.net)');
      return;
    }
    if (support.recorder && (await checkServer())) {
      try {
        ctl = await record(win);
        state = 'recording';
      } catch {
        toast('Permissão do microfone negada');
      }
      return;
    }
    if (support.speech) {
      ctl = speech((t) => insertTranscript(textarea(), t), win);
      state = 'listening';
      return;
    }
    toast('Transcrição indisponível neste navegador');
  }

  async function finishRecording() {
    state = 'busy';
    try {
      const blob = await ctl.stop();
      const out = await transcribe(blob);
      if (!insertTranscript(textarea(), out?.text)) toast('Não entendi o áudio');
    } catch (e) {
      toast('Falha na transcrição: ' + (e?.message || e));
    } finally {
      state = 'idle';
      ctl = null;
    }
  }
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->
<button
  type="button"
  id="pi-chat-mic"
  class="pi-chat-icon-button pi-chat-mic-button"
  class:recording={state === 'recording' || state === 'listening'}
  title={state === 'recording' || state === 'listening'
    ? 'Parar e transcrever'
    : 'Falar (transcrever)'}
  aria-label={state === 'recording' || state === 'listening' ? 'Parar e transcrever' : 'Falar'}
  aria-pressed={state === 'recording' || state === 'listening'}
  disabled={disabled || state === 'busy'}
  onclick={onClick}
  >{@html icon(state === 'busy' ? Loader : state === 'idle' ? Mic : MicOff, {
    size: 15,
    class: state === 'busy' ? 'spinner' : '',
  })}</button
>
