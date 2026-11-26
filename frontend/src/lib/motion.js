import { useEffect, useRef, useState } from 'react';

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A number that runs to `target` instead of jumping to it: fast at first, slowing into place.
// It starts at 0, and from wherever it is when the target changes. With reduced motion it is
// the target at once.
export function useEased(target, duration = 900) {
  const [value, setValue] = useState(() => (still() ? target : 0));
  const current = useRef(value);

  useEffect(() => {
    if (still() || current.current === target) {
      current.current = target;
      setValue(target);
      return undefined;
    }
    const from = current.current;
    const started = performance.now();
    let frame;
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      current.current = progress === 1 ? target : from + (target - from) * (1 - (1 - progress) ** 3);
      setValue(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

// Whether the element has come into view yet. It turns true once and stays true, so that a
// chart draws itself when it is first looked at, not while it is still below the screen.
export function useSeen() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setSeen(true);
      observer.disconnect();
    }, { threshold: 0.3 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, seen];
}
