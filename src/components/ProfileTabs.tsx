import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ProfileTab<T extends string> {
  id: T;
  label: string;
  /** Shorter label used below the sm breakpoint so more tabs fit on a phone. */
  short: string;
  icon: LucideIcon;
  beta?: boolean;
}

interface ProfileTabsProps<T extends string> {
  tabs: readonly ProfileTab<T>[];
  activeTab: T;
  onSelect: (id: T) => void;
  /** id of the tabpanel element each tab controls. */
  panelIdFor: (id: T) => string;
}

/**
 * Horizontally scrollable tab strip. Labels stay visible on phones (icon-only
 * tabs were unguessable); the strip scrolls and the active tab is kept in view.
 */
export function ProfileTabs<T extends string>({ tabs, activeTab, onSelect, panelIdFor }: ProfileTabsProps<T>) {
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const el = tabsRef.current[tabs.findIndex(t => t.id === activeTab)];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab, tabs]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  // Keep the active tab visible inside the strip. Adjusts scrollLeft directly:
  // scrollIntoView would also scroll the page vertically when the strip is
  // below the fold (e.g. on first load).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = tabsRef.current[tabs.findIndex(t => t.id === activeTab)];
    if (!scroller || !el) return;
    const pad = 16;
    const sr = scroller.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.left < sr.left + pad) {
      scroller.scrollLeft -= sr.left + pad - er.left;
    } else if (er.right > sr.right - pad) {
      scroller.scrollLeft += er.right - (sr.right - pad);
    }
  }, [activeTab, tabs]);

  // WAI-ARIA tabs pattern: arrow keys move between tabs, Home/End jump.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onSelect(tabs[next].id);
    tabsRef.current[next]?.focus();
  };

  return (
    <div ref={scrollerRef} className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide">
      <div className="relative flex gap-1 p-1 bg-gray-100/80 dark:bg-slate-800 rounded-xl w-max" role="tablist" aria-label="Profile sections">
        <div
          className="tab-indicator absolute top-1 h-[calc(100%-8px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm z-0"
          style={{ left: indicator.left, width: indicator.width }}
        />
        {tabs.map((tab, i) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={el => { tabsRef.current[i] = el; }}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls={panelIdFor(tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={e => handleKeyDown(e, i)}
              className={`relative z-10 flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                selected
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.beta && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full leading-none">Beta</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
