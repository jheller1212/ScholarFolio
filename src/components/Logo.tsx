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
      <path d="M6 10C6 8 8 7 10 7C12 7 14 8 16 9C18 8 20 7 22 7C24 7 26 8 26 10V23C26 24 25 25 23 25C21 25 19 24 16 23C13 24 11 25 9 25C7 25 6 24 6 23V10Z" stroke="#2d7d7d" strokeWidth="1.8" fill="none"/>
      <line x1="16" y1="9" x2="16" y2="23" stroke="#2d7d7d" strokeWidth="1.5"/>
      <path d="M18 16L21 12L24 8" stroke="#2d7d7d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="24" cy="8" r="1.5" fill="#2d7d7d"/>
    </svg>
  );
}
