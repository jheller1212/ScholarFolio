/**
 * Passive terms notice for auth forms. Replaces a required checkbox that
 * silently blocked one-click "Continue with Google": continuing is the
 * agreement, which is the standard browsewrap-plus-action pattern.
 */
export function AuthLegalNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-gray-500 dark:text-gray-400 ${className}`}>
      By continuing you agree to the{' '}
      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline">
        Terms
      </a>
      {' '}and{' '}
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline">
        Privacy Policy
      </a>.
    </p>
  );
}
