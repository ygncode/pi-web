import { describe, expect, it, vi } from 'vitest';
import {
  insertTranscript,
  pickMimeType,
  transcribeBlob,
  voiceSupport,
  serverAvailable,
} from './voice-input.js';

describe('voice input helpers', () => {
  it('requires a secure context for the microphone', () => {
    const MR = function () {};
    const base = { navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder: MR };
    expect(voiceSupport({ ...base, isSecureContext: false })).toMatchObject({
      secure: false,
      recorder: false,
    });
    expect(voiceSupport({ ...base, isSecureContext: true })).toMatchObject({
      secure: true,
      recorder: true,
    });
    expect(
      voiceSupport({ isSecureContext: true, webkitSpeechRecognition: function () {} }).speech,
    ).toBe(true);
  });

  it('prefers opus webm and falls back to mp4 (iOS)', () => {
    expect(pickMimeType({ isTypeSupported: (t) => t === 'audio/mp4' })).toBe('audio/mp4');
    expect(pickMimeType({ isTypeSupported: () => true })).toBe('audio/webm;codecs=opus');
    expect(pickMimeType(undefined)).toBe('');
  });

  it('appends the transcript and fires input', () => {
    const ta = document.createElement('textarea');
    ta.value = 'oi';
    const onInput = vi.fn();
    ta.addEventListener('input', onInput);
    expect(insertTranscript(ta, ' tudo bem ')).toBe(true);
    expect(ta.value).toBe('oi tudo bem');
    expect(onInput).toHaveBeenCalled();
    expect(insertTranscript(ta, '  ')).toBe(false);
  });

  it('posts the audio with its content type', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ text: 'olá' }) });
    const blob = new Blob(['x'], { type: 'audio/mp4' });
    await expect(transcribeBlob(blob, { fetchImpl, language: 'pt' })).resolves.toEqual({
      text: 'olá',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/transcribe?language=pt',
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'audio/mp4' } }),
    );
  });

  it('reports server availability', async () => {
    const ok = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ available: true }) });
    const down = vi.fn().mockRejectedValue(new Error('x'));
    expect(await serverAvailable(ok)).toBe(true);
    expect(await serverAvailable(down)).toBe(false);
  });
});
