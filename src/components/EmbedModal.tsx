import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Check, Code } from 'lucide-react';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  scholarId: string;
}

export function EmbedModal({ isOpen, onClose, scholarId }: EmbedModalProps) {
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
  const safeScholarId = scholarId.replace(/[^a-zA-Z0-9_-]/g, '');

  const embedCode = `<iframe
  src="https://scholar-metrics.netlify.app/embed/${safeScholarId}"
  width="100%"
  height="600"
  frameborder="0"
  scrolling="no"
  allowtransparency="true"
></iframe>`;

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center space-x-2">
            <Code className="h-5 w-5 text-[#2d7d7d]" />
            <h2 className="text-lg font-semibold text-gray-900">Embed Metrics</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Copy and paste this code into your website to embed your Scholar Folio:
          </p>
          
          <div className="relative">
            <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 font-mono overflow-x-auto">
              {embedCode}
            </pre>
            
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center space-x-1"
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
          
          <div className="bg-[#eaf4f4] rounded-lg p-4 text-sm text-[#1e293b]">
            <h3 className="font-medium mb-2">Customization Options:</h3>
            <ul className="list-disc list-inside space-y-1 text-[#334155]">
              <li>Adjust the width and height attributes to fit your layout</li>
              <li>The embed automatically adapts to light/dark themes</li>
              <li>Metrics are updated in real-time as citations change</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}