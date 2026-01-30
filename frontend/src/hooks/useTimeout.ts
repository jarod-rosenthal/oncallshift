import { useCallback, useEffect, useRef } from 'react';

/**
 * Provides a safe wrapper around setTimeout that automatically clears the timer
 * on unmount and keeps the callback reference up to date between renders.
 */
export function useTimeout(callback: () => void) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = useCallback(
    (delay: number) => {
      if (typeof delay !== 'number' || Number.isNaN(delay)) {
        return;
      }

      clear();
      timeoutRef.current = setTimeout(() => {
        callbackRef.current();
        timeoutRef.current = null;
      }, delay);
    },
    [clear]
  );

  useEffect(() => clear, [clear]);

  return { start, clear };
}
