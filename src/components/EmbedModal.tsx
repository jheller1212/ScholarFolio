import { useState, useRef, useEffect } from 'react';
import { X, Copy, Check, Code } from 'lucide-react';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholarId: string;
  authorName: string;
  /** Canonical page URL the badge links to (vanity slug if claimed). */
  profileUrl: string;
}

export function EmbedModal({ isOpen, onClose, scholarId, authorName, profileUrl }: EmbedModalProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number>();

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Sanitize scholarId to prevent XSS when embed code is pasted into other sites
  const safeScholarId = scholarId.replace(/[^a-zA-Z0-9_:-]/g, '');
  const badgeUrl = `https://scholarfolio.org/badge/${safeScholarId}.svg`;
  const safeName = authorName.replace(/[<>"&]/g, '');

  const embedCode = `<a href="${profileUrl}">
  <img src="${badgeUrl}" alt="${safeName} on ScholarFolio" height="20">
</a>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="embed-modal-title"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center space-x-2">
            <Code className="h-5 w-5 text-[#2d7d7d]" />
            <h2 id="embed-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Embed badge</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add a live citation badge to your personal or university page — it links back to this
            profile and updates automatically as citations change:
          </p>

          <div className="flex items-center justify-center py-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <img src={badgeUrl} alt={`${safeName} on ScholarFolio`} height={20} />
          </div>

          <div className="relative">
            <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200 font-mono overflow-x-auto">
              {embedCode}
            </pre>

            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center space-x-1"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-[#eaf4f4] dark:bg-[#2d7d7d]/10 rounded-lg p-4 text-sm text-[#1e293b] dark:text-gray-200">
            <ul className="list-disc list-inside space-y-1 text-[#334155] dark:text-gray-300">
              <li>Plain HTML — works on university CMS pages, WordPress, Notion, and GitHub READMEs (Markdown: <code className="text-xs">[![ScholarFolio]({badgeUrl})]({profileUrl})</code>)</li>
              <li>Citation counts refresh about once a day</li>
              <li>The badge links readers to your full ScholarFolio profile</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
