import { useEffect, useState } from 'react';

/** Copies `text` to the clipboard, or opens the share sheet where copying isn't possible. */
export default function ShareButton({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const t = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(t);
  }, [status]);

  async function share() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      try {
        await navigator.share({ text });
      } catch {
        setStatus('failed');
      }
    }
  }

  return (
    <button type="button" className="btn ghost" onClick={share}>
      {status === 'copied' ? 'Copied ✓' : status === 'failed' ? "Couldn't copy" : 'Share result'}
    </button>
  );
}
