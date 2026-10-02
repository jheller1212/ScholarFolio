/**
 * True when the visitor asked the OS for reduced motion. index.css already
 * neutralises CSS animations for them; JS-driven animations must check this.
 */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
