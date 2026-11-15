import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MicButton from './MicButton.svelte';

function fakeWin() {
  const ta = document.createElement('textarea');
  ta.id = 'pi-chat-message';
  document.body.appendChild(ta);
  return {
    ta,
    win: {
      document,
      isSecureContext: true,
      navigator: { mediaDevices: { getUserMedia() {} } },
      MediaRecorder: function () {},
    },
  };
}

describe('MicButton', () => {
  it('records, transcribes with Whisper and fills the composer', async () => {
    const user = userEvent.setup();
    const { ta, win } = fakeWin();
    const stop = vi.fn().mockResolvedValue(new Blob(['a'], { type: 'audio/mp4' }));
    const record = vi.fn().mockResolvedValue({ stop });
    const transcribe = vi.fn().mockResolvedValue({ text: 'roda os testes' });
    const { getByRole } = render(MicButton, {
      props: { win, checkServer: () => Promise.resolve(true), record, transcribe },
    });
    await user.click(getByRole('button'));
    await waitFor(() => expect(getByRole('button').getAttribute('aria-pressed')).toBe('true'));
    await user.click(getByRole('button'));
    await waitFor(() => expect(ta.value).toBe('roda os testes'));
    expect(transcribe).toHaveBeenCalled();
    ta.remove();
  });

  it('falls back to Web Speech when the server is down', async () => {
    const user = userEvent.setup();
    const { ta, win } = fakeWin();
    win.webkitSpeechRecognition = function () {};
    const speech = vi.fn((onText) => {
      onText('olá');
      return { stop() {} };
    });
    const record = vi.fn();
    const { getByRole } = render(MicButton, {
      props: { win, checkServer: () => Promise.resolve(false), record, speech },
    });
    await user.click(getByRole('button'));
    await waitFor(() => expect(ta.value).toBe('olá'));
    expect(record).not.toHaveBeenCalled();
    ta.remove();
  });
});
