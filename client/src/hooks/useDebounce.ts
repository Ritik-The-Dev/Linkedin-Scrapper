import { useEffect, useState } from 'react';

/**
 * Delays a value until it has stopped changing for `delay` ms.
 *
 * Used so typing in the search box does not fire a request per keystroke.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
