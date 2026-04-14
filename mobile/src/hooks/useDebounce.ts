import { useRef } from 'react';

export function useDebounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return (...args: T) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  };
}
