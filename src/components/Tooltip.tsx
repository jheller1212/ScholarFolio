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
  const [resolvedPosition, setResolvedPosition] = useState(position);
  const hideTimeoutRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Dynamically flip position when tooltip would overflow viewport
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const tooltipHeight = 220;

    if (position === 'bottom' && rect.bottom + tooltipHeight > viewportHeight) {
      setResolvedPosition('top');
    } else if (position === 'top' && rect.top - tooltipHeight < 0) {
      setResolvedPosition('bottom');
    } else {
      setResolvedPosition(position);
    }
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
          className={`absolute z-50 w-72 p-4 ${
            resolvedPosition === 'top'
              ? 'bottom-full mb-2'
              : 'top-full mt-2'
          } -translate-x-1/2 left-1/2 bg-white/95 backdrop-blur-lg rounded-xl shadow-lg border border-gray-100/50`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="relative">
            <p className="text-sm text-gray-700 mb-3">{content.description}</p>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Strengths:</p>
                <p className="text-xs text-gray-600">{content.pros}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Limitations:</p>
                <p className="text-xs text-gray-600">{content.cons}</p>
              </div>

              {content.link && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <a
                    href={content.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-[#2d7d7d] hover:text-[#1f5c5c] transition-colors"
                  >
                    <span>Learn more</span>
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </div>
              )}
            </div>

            <div className={`absolute ${
              resolvedPosition === 'top'
                ? '-bottom-2 border-t border-r'
                : '-top-2 border-b border-r'
            } left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 transform rotate-45 border-gray-100/50`}></div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
