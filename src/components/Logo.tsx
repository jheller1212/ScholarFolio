import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#019DD4" />
          <stop offset="100%" stopColor="#E84E10" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
      <rect x="7" y="18" width="4" height="8" rx="1" fill="white" opacity="0.9" />
      <rect x="14" y="12" width="4" height="14" rx="1" fill="white" />
      <rect x="21" y="7" width="4" height="19" rx="1" fill="white" opacity="0.9" />
      <path d="M16 5L10 8L16 11L22 8L16 5Z" fill="white" opacity="0.6" />
    </svg>
  );
}
