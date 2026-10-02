import React from 'react';
import { ArrowLeft, Building2, Check, ExternalLink, Mail } from 'lucide-react';
import { Logo } from './Logo';

interface InstitutionsPageProps {
  onBack: () => void;
  onNavigateAbout: () => void;
  socialLinks?: React.ReactNode;
  authControls?: React.ReactNode;
}

const CONTACT_EMAIL = 'info@scholarfolio.org';
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('ScholarFolio sustaining membership')}`;

interface Tier {
  name: string;
  examples: string;
  amount: string;
}

// Benchmarked against arXiv's lowest membership tier and the SCOSS/DOAJ
// small/large institution levels. Suggested amounts, not prices: membership unlocks nothing that non-members
// lack, so institutions can contribute more or less than these figures.
const TIERS: Tier[] = [
  { name: 'Department', examples: 'A department, research group or institute', amount: '€1,000' },
  { name: 'Faculty / Graduate school', examples: 'A faculty, school or doctoral programme', amount: '€2,000' },
  { name: 'University / Library', examples: 'A university library, research office or whole institution', amount: '€4,000' },
];

const BENEFITS: { title: string; body: string }[] = [
  {
    title: 'Your logo on the public supporters list',
    body: 'Listed on ScholarFolio as a sustaining member, so your researchers and peers see who keeps the tool open.',
  },
  {
    title: 'A department page',
    body: "One page listing your researchers' ScholarFolio profiles, useful for onboarding, visiting committees and recruitment.",
  },
  {
    title: 'A narrative-CV workshop for staff',
    body: 'One session (online or on site) on building a narrative CV and reading research metrics responsibly, using ScholarFolio as the working example.',
  },
  {
    title: 'Priority support and input on the roadmap',
    body: 'A direct line for questions and data corrections, and a say in what gets built next.',
  },
  {
    title: 'A usage report',
    body: 'An aggregate overview of how your researchers use ScholarFolio. No individual tracking, no data sold or shared.',
  },
];

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1">
      {children} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function InstitutionsPage({ onBack, onNavigateAbout, socialLinks, authControls }: InstitutionsPageProps) {
  return (
    <main className="flex-1 mesh-bg min-h-screen">
      <nav className="border-b border-gray-200/60 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <button onClick={onBack} aria-label="Back" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-3">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <Logo size={28} />
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm tracking-tight ml-3">Scholar Folio</span>
          <div className="ml-auto flex items-center gap-3">
            {socialLinks}
            {authControls}
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2d7d7d] mb-3 inline-flex items-center gap-2">
          <Building2 className="h-4 w-4" /> For institutions
        </p>
        <h1 className="font-serif text-4xl font-bold text-[#1e293b] mb-6">Become a sustaining member</h1>

        <div className="space-y-10 text-[15px] text-[#334155] leading-relaxed">
          <section>
            <p className="mb-3">
              ScholarFolio is free and open source for every researcher, and it stays that way. No subscriptions,
              no ads, no paywalled features, no data monetization. Running it still costs money: every fresh
              Google Scholar lookup goes through a paid API, plus hosting and maintenance.
            </p>
            <p>
              Sustaining membership is how departments, graduate schools, libraries and research offices can
              fund an open tool their researchers already use, following the model of community-supported
              infrastructure such as arXiv and OpenAlex. Members do not buy access to anything. They make sure
              it stays open for everyone, including researchers at institutions that cannot contribute.
            </p>
            <p className="mt-3 text-sm text-[#64748b]">
              Comparable open infrastructures such as arXiv, DOAJ and OpenAlex are funded the same way.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Why it fits responsible research assessment</h2>
            <p className="mb-3">
              The Dutch <ExtLink href="https://recognitionrewards.nl/about/position-paper/">Recognition &amp; Rewards</ExtLink>{' '}
              programme, the <ExtLink href="https://sfdora.org/">San Francisco Declaration on Research Assessment (DORA)</ExtLink>{' '}
              and the <ExtLink href="https://coara.eu/agreement/the-agreement-full-text/">CoARA agreement</ExtLink>{' '}
              all ask institutions to move away from single numbers such as the journal impact factor or a raw
              h-index, and towards qualitative, contextualised evidence.
            </p>
            <p className="mb-3">
              Funders already work this way. NWO, which{' '}
              <ExtLink href="https://www.nwo.nl/en/dora">has signed DORA</ExtLink>, uses an{' '}
              <ExtLink href="https://www.nwo.nl/en/evidence-based-cv">evidence-based CV</ExtLink>{' '}
              in Veni, Vidi and Vici pre-proposals, and from 2026 the ERC asks for a merged CV and track record of
              four pages with up to ten selected outputs. Researchers need to show their work in context, briefly.
            </p>
            <p className="mb-3">
              ScholarFolio is built for that shift. It puts metrics in context (field-normalised impact, the
              p-index within journal and year, open access share, collaboration networks) and helps researchers
              draft a <strong>narrative CV</strong> that describes contributions in their own words. The numbers are
              context for a story, not a ranking.
            </p>
            <p>
              Supporting an open, transparent tool for this is a concrete, visible step for institutions that have
              signed DORA or joined CoARA.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-4">What members receive</h2>
            <p className="mb-4 text-[#64748b] text-sm">
              None of this is a feature locked away from other users. Everything researchers can do on ScholarFolio
              remains free for everyone.
            </p>
            <ul className="space-y-3">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex gap-3">
                  <Check className="h-5 w-5 text-[#2d7d7d] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#1e293b]">{b.title}</p>
                    <p className="text-sm text-[#64748b]">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-4">Suggested annual contributions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {TIERS.map((t) => (
                <div key={t.name} className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
                  <p className="font-semibold text-[#1e293b] mb-1">{t.name}</p>
                  <p className="text-2xl font-bold text-[#2d7d7d]">{t.amount}</p>
                  <p className="text-xs text-[#64748b] mt-1">per year</p>
                  <p className="text-sm text-[#64748b] mt-3">{t.examples}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#64748b]">
              These are suggested contributions, not prices. Membership is invoiced annually, can be cancelled at any
              time, and every tier receives the same benefits. Joining through a consortium (for example UNL or SURF)
              gives 10% off. If your budget does not match a tier, get in touch anyway.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Where the money goes</h2>
            <p>
              Contributions cover the Google Scholar API, hosting and maintenance first. Any surplus is donated to
              open science initiatives, and the figures are published on the{' '}
              <a
                href="/about"
                onClick={(e) => { e.preventDefault(); onNavigateAbout(); }}
                className="text-[#2d7d7d] hover:underline"
              >
                About page
              </a>.
            </p>
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-card p-6 text-center">
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-2">Interested?</h2>
            <p className="text-sm text-[#64748b] mb-5">
              Send a short note with your institution and the contact for invoicing, and I will reply personally.
            </p>
            <a
              href={MAILTO}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2d7d7d] text-white text-sm font-medium rounded-lg hover:bg-[#256b6b] transition-colors"
            >
              <Mail className="h-4 w-4" /> {CONTACT_EMAIL}
            </a>
            <p className="text-xs text-[#94a3b8] mt-4">Jonas Heller, Maastricht University</p>
          </section>
        </div>
      </div>
    </main>
  );
}
