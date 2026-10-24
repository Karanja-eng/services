// src/hooks/useMediaQuery.js
//
// Minimal, SSR-safe media-query hook.
//
// Why not a CSS-only solution everywhere: some layouts must *unmount* a viewer
// (a WebGL context is expensive) or switch a panel into a drawer, which CSS alone
// cannot do. Everywhere else the responsive behaviour stays in Tailwind classes —
// this hook exists only for the cases where JavaScript genuinely has to know.

import { useEffect, useState } from 'react';

/**
 * @param {string} query a CSS media query, e.g. `(min-width: 768px)`
 * @param {boolean} [fallback] value used before the browser reports a match
 */
export function useMediaQuery(query, fallback = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return fallback;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(list.matches);
    if (list.addEventListener) list.addEventListener('change', onChange);
    else list.addListener(onChange);
    return () => {
      if (list.removeEventListener) list.removeEventListener('change', onChange);
      else list.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

/** `true` on phones (below Tailwind's `md`). */
export function useIsPhone() {
  return !useMediaQuery('(min-width: 768px)', false);
}

/** `true` on laptop-and-up screens (Tailwind's `lg`). */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)', false);
}

export default useMediaQuery;
