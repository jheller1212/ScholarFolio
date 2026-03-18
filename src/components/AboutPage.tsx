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
          {/* Section 1: What it is */}
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
                href="https://github.com/JonasHeller1212/ResearchFolio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1"
              >
                View on GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </section>

          {/* Section 2: Pricing */}
          <hr className="border-gray-200" />

          <section>
            <h2 className="font-serif text-2xl font-bold text-[#1e293b] mb-6">Pricing</h2>

            <p className="mb-4">
              Scholar Folio is free to try: <strong>3 searches without signing up</strong>, and{' '}
              <strong>5 more when you create an account</strong>.
            </p>

            <p className="mb-4">After that, credit packs cover the API costs:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
                <p className="font-semibold text-[#1e293b] mb-1">Starter</p>
                <p className="text-2xl font-bold text-[#2d7d7d]">&euro;5</p>
                <p className="text-sm text-[#64748b] mt-1">15 searches</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
                <p className="font-semibold text-[#1e293b] mb-1">Pro</p>
                <p className="text-2xl font-bold text-[#2d7d7d]">&euro;10</p>
                <p className="text-sm text-[#64748b] mt-1">40 searches</p>
              </div>
            </div>

            <div className="space-y-3">
              <p>
                <strong>Why it is not completely free:</strong> Every profile lookup requires an API call to
                retrieve Google Scholar data, and that API charges per request. The credit packs exist to
                cover this cost. There are no subscriptions, no feature gating between free and paid users,
                and no data monetization.
              </p>
              <p>
                <strong>Cached profiles</strong> (searched by anyone in the last 72 hours) are always free
                and do not cost a credit.
              </p>
            </div>
          </section>

          {/* Section 3: Transparency Report */}
          <hr className="border-gray-200" />

          <section>
            <h2 className="font-serif text-2xl font-bold text-[#1e293b] mb-6">Transparency Report &amp; Donation Commitment</h2>

            <p className="mb-4">
              Scholar Folio publishes a transparency report covering revenue, API costs, hosting costs, and
              any surplus.
            </p>

            <p className="mb-6">
              If there is ever a surplus after covering operating costs, it will be donated to open science
              initiatives. This is not a business. It is an academic side project that costs money to run.
              The commitment to transparency and donation is here from day one — even though the amounts are
              currently tiny.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="text-left px-4 py-3 font-semibold text-[#1e293b] border-b border-gray-200">Category</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#1e293b] border-b border-gray-200">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 border-b border-gray-100">Total Revenue</td>
                    <td className="px-4 py-3 border-b border-gray-100 text-[#64748b] italic">—</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 border-b border-gray-100">Total Costs (API + Hosting)</td>
                    <td className="px-4 py-3 border-b border-gray-100 text-[#64748b] italic">—</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 border-b border-gray-100">Surplus</td>
                    <td className="px-4 py-3 border-b border-gray-100 text-[#64748b] italic">—</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Donated To</td>
                    <td className="px-4 py-3 text-[#64748b] italic">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm text-[#94a3b8] italic mt-4">
              First report coming Q2 2026.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
