import { cn } from '../../utils/cn.ts';

interface SpinnerProps {
  /** Pixel size of the square. */
  size?: number;
  className?: string;
  /** Announce a busy state to assistive tech; omit when a parent already does. */
  label?: string;
}

/** Determinate-looking arc spinner. Motion is neutralised by prefers-reduced-motion. */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span
      className={cn('inline-flex shrink-0', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spinslow"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
