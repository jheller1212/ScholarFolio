import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';

interface PrivacyPageProps {
  onBack: () => void;
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <main className="flex-1 mesh-bg min-h-screen">
      <nav className="border-b border-gray-200/60 bg-white/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors mr-3">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <Logo size={28} />
          <span className="font-semibold text-gray-900 text-sm tracking-tight ml-3">Scholar Folio</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-20">
        <h1 className="font-serif text-4xl font-bold text-[#1e293b] mb-10">Privacy Policy</h1>

        <div className="space-y-8 text-[15px] text-[#334155] leading-relaxed">
          <p>Scholar Folio does not collect personal data.</p>

          <p>
            It does not use cookies beyond what is strictly necessary for the app to function.
          </p>

          <p>
            Google Scholar profile URLs entered are not stored or logged.
          </p>

          <p>
            No analytics tracking beyond anonymous page view counts (if applicable).
          </p>

          <p>
            No third-party advertising or data brokers.
          </p>

          <p>
            The tool is hosted on Netlify. Netlify's own privacy policy applies to
            infrastructure-level data.
          </p>
        </div>
      </div>
    </main>
  );
}
