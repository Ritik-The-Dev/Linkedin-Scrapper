import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts';
import { cn } from '../../utils/cn.ts';

interface RevealProps {
  children: ReactNode;
  /** Stagger in milliseconds, for sequencing a small group of elements. */
  delay?: number;
  className?: string;
}

/**
 * Fades content in the first time it scrolls into view.
 *
 * When the OS asks for reduced motion the content is simply rendered — no
 * transform, no transition, no observer.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver !== 'function') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={cn(
        'motion-translate transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      )}
      style={reduced || delay === 0 ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
