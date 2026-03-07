import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';

interface TermsPageProps {
  onBack: () => void;
}

export function TermsPage({ onBack }: TermsPageProps) {
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
        <h1 className="font-serif text-4xl font-bold text-[#1e293b] mb-10">Terms of Use</h1>

        <div className="space-y-8 text-[15px] text-[#334155] leading-relaxed">
          <p>
            Scholar Folio is provided free of charge, as-is, for personal and academic use.
          </p>

          <p>
            It uses publicly available data from Google Scholar. It does not store, sell, or share user data.
          </p>

          <p>
            The tool is not affiliated with Google or Google Scholar.
          </p>

          <p>
            Citation and index figures are pulled directly from Google Scholar and may differ from other
            sources. We make no guarantees of accuracy.
          </p>

          <p>
            This tool is not intended for institutional evaluation, hiring decisions, or performance
            assessment of researchers. Using it for those purposes is contrary to its intent.
          </p>

          <p>
            By using Scholar Folio you agree not to use it to rank, compare, or evaluate researchers
            for employment or promotion decisions.
          </p>

          <p>
            The tool is open source. Contributions welcome.
          </p>

          <p>
            Contact:{' '}
            <a
              href="https://www.linkedin.com/in/hellerjonas/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1"
            >
              Jonas Heller on LinkedIn <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
