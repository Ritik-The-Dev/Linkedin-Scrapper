import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '../../utils/cn.ts';
import { CheckIcon, CopyIcon } from './icons.tsx';

interface CopyButtonProps {
  value: string;
  /** Describes what is being copied, for the accessible label. */
  label: string;
  className?: string;
}

/** Copies a value to the clipboard and confirms it briefly. */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(() => {
    const done = (): void => {
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(done, () => setCopied(false));
      return;
    }
    // Older browsers: a hidden textarea is the only route.
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    try {
      document.execCommand('copy');
      done();
    } finally {
      document.body.removeChild(field);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs text-ink-faint',
        'transition-colors hover:bg-ink/[0.05] hover:text-ink-soft',
        className,
      )}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-ok-500" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      <span aria-hidden="true">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
