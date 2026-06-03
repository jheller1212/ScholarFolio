import React, { useState, useRef, useEffect, useCallback } from 'react';
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

export function Tooltip({ content, children, position = 'bottom' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: position as 'top' | 'bottom' });

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Position tooltip using fixed coordinates relative to viewport
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const tooltipEl = tooltipRef.current;
      const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 200;
      const viewportHeight = window.innerHeight;
      const gap = 8;

      // Decide placement
      let placement = position;
      const spaceBelow = viewportHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;

      if (placement === 'bottom' && spaceBelow < tooltipHeight && spaceAbove > spaceBelow) {
        placement = 'top';
      } else if (placement === 'top' && spaceAbove < tooltipHeight && spaceBelow > spaceAbove) {
        placement = 'bottom';
      }

      const top = placement === 'bottom'
        ? rect.bottom + gap
        : rect.top - gap;

      // Center horizontally, clamped to viewport
      const centerX = rect.left + rect.width / 2;
      const tooltipWidth = 240; // w-60 = 15rem = 240px
      let left = centerX - tooltipWidth / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

      setCoords({ top, left, placement });
    };

    updatePosition();

    // Recalc after tooltip renders (so we have actual height)
    requestAnimationFrame(updatePosition);
  }, [isVisible, position]);

  const handleMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, 300);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 w-60 p-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg rounded-lg shadow-lg border border-gray-100/50 dark:border-slate-700/50 max-h-[min(320px,60vh)] overflow-y-auto"
          style={{
            top: coords.placement === 'bottom' ? `${coords.top}px` : undefined,
            bottom: coords.placement === 'top' ? `${window.innerHeight - coords.top}px` : undefined,
            left: `${coords.left}px`,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
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
                  className="inline-flex items-center text-[10px] text-[#2d7d7d] hover:text-[#1f5c5c] transition-colors"
                >
                  <span>Learn more</span>
                  <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
