import { useCallback, useState } from 'react';
import { cn } from '../../utils/cn.ts';

interface CopyJsonButtonProps {
  data: unknown;
  /** 'icon' = small icon-only button (for cards). 'label' = icon + text (for headers). */
  variant?: 'icon' | 'label';
  className?: string;
}

/**
 * Copies the given data as formatted JSON to the clipboard.
 * 'icon' variant: compact icon-only button, suitable for card footers.
 * 'label' variant: icon + text, suitable for action rows and header strips.
 */
export function CopyJsonButton({ data, variant = 'label', className }: CopyJsonButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((e: React.MouseEvent) => {
    // Prevent the card's Link from navigating when clicking inside
    e.preventDefault();
    e.stopPropagation();

    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label="Copy raw JSON"
        title={copied ? 'Copied!' : 'Copy raw JSON'}
        className={cn(
          'relative z-10 inline-flex size-6 items-center justify-center rounded-md',
          'text-ink-faint transition-colors',
          'hover:bg-ink/[0.06] hover:text-ink-soft',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
          copied && 'text-green-600',
          className,
        )}
      >
        {copied ? (
          // Checkmark
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          // Braces icon — visually signals "JSON"
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M4.5 2C3.7 2 3 2.7 3 3.5v2c0 .8-.7 1.5-1.5 1.5C2.3 7 3 7.7 3 8.5v2c0 .8.7 1.5 1.5 1.5M9.5 2c.8 0 1.5.7 1.5 1.5v2c0 .8.7 1.5 1.5 1.5-.8 0-1.5.7-1.5 1.5v2c0 .8-.7 1.5-1.5 1.5"
              stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    );
  }

  // label variant — used in ProfileHeader metadata strip
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy raw JSON"
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5',
        'font-mono text-2xs text-ink-faint',
        'transition-colors hover:bg-ink/[0.05] hover:text-ink-soft',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
        copied && 'text-green-600',
        className,
      )}
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M4.5 2C3.7 2 3 2.7 3 3.5v2c0 .8-.7 1.5-1.5 1.5C2.3 7 3 7.7 3 8.5v2c0 .8.7 1.5 1.5 1.5M9.5 2c.8 0 1.5.7 1.5 1.5v2c0 .8.7 1.5 1.5 1.5-.8 0-1.5.7-1.5 1.5v2c0 .8-.7 1.5-1.5 1.5"
              stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copy JSON
        </>
      )}
    </button>
  );
}
