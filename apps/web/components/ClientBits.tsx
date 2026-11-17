'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { FILE_INPUT_ID } from './Dropzone';

/** Opens the dropzone's file picker (header pill on desktop, thumb bar on phone). */
export function UploadButton({ className, children }: { className: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => document.getElementById(FILE_INPUT_ID)?.click()}>
      {children}
    </button>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy'}
      className="h-11 shrink-0 rounded-full px-4 text-body font-medium text-text-secondary transition-colors duration-120 hover:bg-surface-muted"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** Re-renders the inbox every second while a notice is still being read. */
export function RefreshWhileReading({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 1000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
