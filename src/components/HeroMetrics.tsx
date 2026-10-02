import { useMemo } from 'react';
import { heroMetrics } from '../lib/heroMetrics';
import type { Author } from '../types/scholar';

/** The four Google Scholar headline numbers at the top of a profile. */
export function HeroMetrics({ data }: { data: Author }) {
  const items = useMemo(() => heroMetrics(data), [data]);
  return (
    <dl className="grid grid-cols-4 gap-2 sm:gap-6 w-full md:w-auto">
      {items.map(({ label, value, hint }) => (
        // dt precedes dd in the DOM (as <dl> requires); flex-col-reverse puts the number on top.
        <div key={label} className="flex flex-col-reverse text-center min-w-0" title={hint}>
          <dt className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">{label}</dt>
          <dd className="text-base min-[400px]:text-lg sm:text-2xl font-bold gradient-text tabular-nums truncate">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
