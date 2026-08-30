import { useState } from 'react';

import { cn } from '../../utils/cn.ts';
import { initialsOf } from '../../utils/formatters.ts';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-8 text-[0.6875rem]',
  sm: 'size-10 text-xs',
  md: 'size-14 text-sm',
  lg: 'size-20 text-lg',
  xl: 'size-28 text-2xl sm:size-32 sm:text-3xl',
};

/** Stable hue from the name, so the same person always gets the same tint. */
function hueFor(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

interface AvatarProps {
  src?: string | null;
  /** Used for the alt text and for the initials fallback. */
  name: string;
  size?: AvatarSize;
  className?: string;
  /** Draws a subtle ring, used for the primary avatar on a detail page. */
  ring?: boolean;
}

/**
 * Profile photo with a graceful fallback.
 *
 * LinkedIn CDN URLs are signed and expire, so an `onError` fallback to initials
 * is the difference between a tidy card and a broken-image icon.
 */
export function Avatar({ src, name, size = 'md', className, ring = false }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = typeof src === 'string' && src.length > 0 && src !== failedSrc;

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl',
        'font-display font-semibold tracking-tight text-white',
        SIZES[size],
        ring && 'ring-4 ring-white',
        className,
      )}
      style={
        usable
          ? undefined
          : {
              backgroundImage: `linear-gradient(135deg, hsl(${hueFor(name)} 70% 56%), hsl(${
                (hueFor(name) + 28) % 360
              } 64% 38%))`,
            }
      }
    >
      {usable ? (
        <img
          src={src}
          alt={`${name} profile photo`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}
