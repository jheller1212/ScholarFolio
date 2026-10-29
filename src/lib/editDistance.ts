/**
 * Levenshtein distance — the one implementation for name comparison (author
 * identity, "Did you mean" ranking). Pure and import-free.
 */

/** Edit distance between `a` and `b`. With `max`, stops early and returns
 *  `max + 1` once the distance is certain to exceed it, so callers comparing
 *  many candidates don't pay for full matrices on hopeless pairs. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    if (Math.min(...curr) > max) return max + 1;
    prev = curr;
  }
  return Math.min(prev[b.length], max + 1);
}

/** Whether `a` and `b` are at most `max` edits apart. */
export function editDistanceWithin(a: string, b: string, max: number): boolean {
  return editDistance(a, b, max) <= max;
}
