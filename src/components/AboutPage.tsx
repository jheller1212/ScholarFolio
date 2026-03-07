import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
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
        <h1 className="font-serif text-4xl font-bold text-[#1e293b] mb-10">About Scholar Folio</h1>

        <div className="space-y-10 text-[15px] text-[#334155] leading-relaxed">
          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">What it is</h2>
            <p>
              Scholar Folio is a free, open-source research portfolio tool. Paste your Google Scholar URL
              and get a clear overview of your publication history, collaboration network, and research reach.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">What it is not</h2>
            <p>
              A ranking tool. A benchmarking system. A productivity scorecard.
              The numbers it surfaces are context, not verdict.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Who built it</h2>
            <p>
              Built by{' '}
              <a
                href="https://www.linkedin.com/in/hellerjonas/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1"
              >
                Jonas Heller <ExternalLink className="h-3 w-3" />
              </a>,
              Assistant Professor of Marketing at Maastricht University, researching consumer behavior
              in emerging technologies (AR, VR, AI).
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Why</h2>
            <p>
              Academic culture already has enough ranking anxiety. This tool exists to help researchers
              understand and narrate their own work — on their own terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Open source</h2>
            <p>
              Scholar Folio is open source.{' '}
              <a
                href="https://github.com/JonasHeller1212/ScholarMetricsAnalyzer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1"
              >
                View on GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
