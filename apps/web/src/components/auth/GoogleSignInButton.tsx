import { useEffect, useRef } from 'react';

type GoogleCredentialResponse = { credential: string };

type GoogleAccountsId = {
  initialize: (config: { client_id: string; callback: (resp: GoogleCredentialResponse) => void }) => void;
  renderButton: (
    parent: HTMLElement,
    options: { type: 'icon' | 'standard'; shape: 'circle' | 'pill' | 'rectangular' | 'square'; theme: 'outline' | 'filled_blue' | 'filled_black'; size: 'large' | 'medium' | 'small' },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Google script')));
        return;
      }
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google script'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function GoogleSignInButton({
  clientId,
  onCredential,
  label,
}: {
  clientId: string;
  onCredential: (idToken: string) => void;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleScript().then(() => {
      if (cancelled || !containerRef.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'icon',
        shape: 'circle',
        theme: 'outline',
        size: 'large',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential]);

  return <div ref={containerRef} aria-label={label} className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full" />;
}
