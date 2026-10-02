import React, { useState, useRef, useEffect, useCallback, useId, useLayoutEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface TooltipProps {
  content: {
    description: string;
    pros: string;
    cons: string;
    link?: string;
  };
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

const TOOLTIP_WIDTH = 240; // w-60
const GAP = 8;

/**
 * Metric explanation popover. Works with mouse hover, tap (toggle) and
 * keyboard focus; Escape or a tap/click outside closes it. Most profile
 * traffic is mobile, where the old hover-only version never opened.
 */
export function Tooltip({ content, children, position = 'bottom' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: position as 'top' | 'bottom' });

  const clearHide = () => {
    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
  };

  useEffect(() => clearHide, []);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;

    let placement = position;
    if (placement === 'bottom' && spaceBelow < tooltipHeight && spaceAbove > spaceBelow) placement = 'top';
    else if (placement === 'top' && spaceAbove < tooltipHeight && spaceBelow > spaceAbove) placement = 'bottom';

    const top = placement === 'bottom' ? rect.bottom + GAP : rect.top - GAP;
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(8, Math.min(centerX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8));
    setCoords({ top, left, placement });
  }, [position]);

  // Position before paint, and follow the card while the page scrolls.
  useLayoutEffect(() => {
    if (!isVisible) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, updatePosition]);

  // Tap or click outside closes; Escape closes from anywhere.
  useEffect(() => {
    if (!isVisible) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsVisible(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVisible(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isVisible]);

  // Hover only for real mice: touch browsers emulate mouseenter before click,
  // which would open-then-immediately-toggle-closed on every tap.
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearHide();
    setIsVisible(true);
  };
  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    hideTimeoutRef.current = window.setTimeout(() => setIsVisible(false), 300);
  };

  // Remember how the last interaction started: a tap focuses the trigger
  // before its click fires, and opening on that focus would make the click
  // toggle it straight back closed.
  const lastPointerType = useRef<string | null>(null);

  const handleTriggerClick = () => {
    clearHide();
    // A mouse already opened it on hover; clicking should keep it open.
    if (lastPointerType.current === 'mouse') setIsVisible(true);
    else setIsVisible(v => !v);
    lastPointerType.current = null;
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsVisible(v => !v);
    }
  };

  const handleTriggerFocus = () => {
    if (lastPointerType.current) return; // pointer focus — the click decides
    setIsVisible(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Keep it open while focus moves into the popover (e.g. the link).
    if (containerRef.current?.contains(e.relatedTarget as Node | null)) return;
    setIsVisible(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative block"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onBlur={handleBlur}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isVisible}
        aria-describedby={tooltipId}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7d7d] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        onPointerDown={e => { lastPointerType.current = e.pointerType; }}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        onFocus={handleTriggerFocus}
      >
        {children}
      </div>
      {/* Always in the DOM (hidden when closed) so aria-describedby resolves
          for screen readers even before the popover is shown. */}
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        hidden={!isVisible}
        className="fixed z-50 w-60 max-w-[calc(100vw-16px)] p-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg rounded-lg shadow-lg border border-gray-100/50 dark:border-slate-700/50 max-h-[min(320px,60vh)] overflow-y-auto text-left cursor-auto"
        style={{
          top: coords.placement === 'bottom' ? `${coords.top}px` : undefined,
          bottom: coords.placement === 'top' ? `${window.innerHeight - coords.top}px` : undefined,
          left: `${coords.left}px`,
        }}
      >
        <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 mb-2">{content.description}</p>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Strengths:</p>
            <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">{content.pros}</p>
          </div>

          <div>
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Limitations:</p>
            <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">{content.cons}</p>
          </div>

          {content.link && (
            <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-700">
              <a
                href={content.link}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={isVisible ? 0 : -1}
                className="inline-flex items-center text-[10px] text-[#2d7d7d] hover:text-[#1f5c5c] transition-colors"
              >
                <span>Learn more</span>
                <ExternalLink className="h-2.5 w-2.5 ml-1" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
