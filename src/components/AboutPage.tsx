import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';
import { supabase } from '../lib/supabase';
import { ANON_FREE_LOOKUPS, MONTHLY_FREE_LOOKUPS, PROFILE_CACHE_DAYS, SUPPORT_PACKS } from '../lib/constants';

interface AboutPageProps {
  onBack: () => void;
  socialLinks?: React.ReactNode;
  authControls?: React.ReactNode;
  onNavigateInstitutions?: () => void;
}

/** Aggregate-only figures from the `transparency_report` RPC — revenue through
 *  the end of the last completed quarter, rolling over automatically. */
interface TransparencyReport {
  revenue_cents: number;
  purchase_count: number;
  first_purchase: string | null;
  through: string;
}

// Date-only strings parse as UTC midnight — read them back in UTC too, or a
// negative-offset browser shifts them into the previous day/month/quarter.
function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}

export function AboutPage({ onBack, socialLinks, authControls, onNavigateInstitutions }: AboutPageProps) {
  const [report, setReport] = useState<TransparencyReport | null>(null);
  const [reportFailed, setReportFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('transparency_report')
      .then(({ data, error }) => {
        if (cancelled) return;
        // Guard the shape so an RPC drift shows the fallback, not "€NaN".
        if (error || !data || typeof (data as TransparencyReport).revenue_cents !== 'number') {
          setReportFailed(true);
        } else {
          setReport(data as TransparencyReport);
        }
      })
      .catch(() => { if (!cancelled) setReportFailed(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="flex-1 mesh-bg min-h-screen">
      <nav className="border-b border-gray-200/60 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mr-3">
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
        <h1 className="font-serif text-4xl font-bold text-[#1e293b] mb-10">About Scholar Folio</h1>

        <div className="space-y-10 text-[15px] text-[#334155] leading-relaxed">
          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">The short version</h2>
            <p>
              Scholar Folio turns your Google Scholar profile into a shareable research portfolio. Paste your URL,
              get back a page with your metrics, citation trends, co-author network, a world map, open access breakdown,
              and a p-index score. The whole thing takes about ten seconds.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Why it exists</h2>
            <p className="mb-3">
              I am a marketing professor, not a bibliometrics researcher. But I kept running into the same problem:
              every time I needed to present my research profile (for a grant, a tenure case, a collaboration pitch)
              I ended up spending hours manually pulling numbers from different sources and putting them into slides
              that would be outdated by the time I presented them.
            </p>
            <p className="mb-3">
              So I built the thing I wanted. A single page that pulls everything together automatically. It started
              as a weekend project and kept growing because other researchers found it useful too.
            </p>
            <p>
              This is not a ranking tool. Academic culture already has plenty of ranking anxiety. The numbers here
              are context for understanding your own work, not a verdict on it.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">What you actually get</h2>
            <p className="mb-3">
              The basics are what you would expect: h-index, g-index, i10, citation growth over time, that sort of thing.
              But the interesting parts go further.
            </p>
            <p className="mb-3">
              There is a <strong>field-normalized impact score</strong> (FWCI) so you can compare a political scientist
              with a chemist without the usual apples-to-oranges problem. There is a <strong>co-author world map</strong> that
              shows where your collaborators are based. There is an <strong>open access breakdown</strong> (gold, green, hybrid,
              bronze) so you can see how much of your work is actually accessible to people who do not have a university library card.
            </p>
            <p>
              And there is the <strong>p-index</strong>, which I did not invent (credit goes to Pham, Wu &amp; Wang, 2024). It measures
              where your papers rank in citations <em>within their own journal and publication year</em>, which means it is not biased
              by field size or career stage. You review your publications before it runs, so you stay in control of what gets included.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Where the data comes from</h2>
            <p className="mb-3">
              Profile data comes from Google Scholar, accessed through an API called SerpAPI. Everything else
              (open access stats, co-author locations, ORCID links, field-normalized metrics, journal citation distributions)
              comes from OpenAlex, which is an open bibliometric database run by a nonprofit.
            </p>
            <p>
              Nothing is stored permanently. There is a {PROFILE_CACHE_DAYS}-day cache to avoid hammering the APIs, and that is it.
              No researcher data is sold, shared, or monetized. Ever.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold text-[#1e293b] mb-3">Who is behind this</h2>
            <p className="mb-3">
              I am{' '}
              <a
                href="https://www.linkedin.com/in/hellerjonas/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1"
              >
                Jonas Heller <ExternalLink className="h-3 w-3" />
              </a>,
              Assistant Professor of Marketing at Maastricht University. My actual research is on consumer behavior
              in emerging technologies (AR, VR, AI), which is how I ended up building this in the first place. I kept
              using these tools for my own work, got frustrated with what was available, and decided to make something better.
            </p>
            <p>
              Scholar Folio is open source, built in my evenings and weekends, and not affiliated with my university.{' '}
              <a
                href="https://github.com/JonasHeller1212/ResearchFolio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1"
              >
                The code is on GitHub <ExternalLink className="h-3 w-3" />
              </a>{' '}
              if you want to look under the hood.
            </p>
          </section>

          {/* Section 2: Funding */}
          <hr className="border-gray-200" />

          <section>
            <h2 className="font-serif text-2xl font-bold text-[#1e293b] mb-6">How it is funded</h2>

            <p className="mb-4">
              Scholar Folio is free and open source (MIT licence), and it stays that way: no subscriptions, no ads,
              no paywalled features, and no data monetization. What does cost money is fetching fresh data. Every new
              Google Scholar lookup goes through an API that charges per request, plus hosting and a domain.
            </p>

            <p className="mb-3">Those costs are covered in three ways:</p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>
                <strong>Institutional sustaining members.</strong> Departments, graduate schools, libraries and research
                offices contribute annually so the tool stays open for everyone, the way arXiv and OpenAlex are supported.
                Members get recognition and services, never exclusive features.
                {onNavigateInstitutions && (
                  <>
                    {' '}
                    <a
                      href="/institutions"
                      onClick={(e) => { e.preventDefault(); onNavigateInstitutions(); }}
                      className="text-[#2d7d7d] hover:underline"
                    >
                      Information for institutions
                    </a>.
                  </>
                )}
              </li>
              <li>
                <strong>Research grants</strong> for open research infrastructure and responsible research assessment.
              </li>
              <li>
                <strong>Voluntary support</strong> from individual researchers. If Scholar Folio is useful to you, you can
                chip in {SUPPORT_PACKS.map((p) => `€${p.priceEur}`).join(' or ')}. As a thank-you you get extra fresh lookups,
                but supporting is optional and nothing on the site depends on it.
              </li>
            </ul>

            <p className="mb-3">
              To keep API costs predictable there is a fair-use limit on <em>fresh</em> lookups: {ANON_FREE_LOOKUPS} without
              signing up, and {MONTHLY_FREE_LOOKUPS} every month with a free account. With an account, profiles someone
              looked up in the last {PROFILE_CACHE_DAYS} days load from the cache and never count against it. Direct profile
              links and claimed profile URLs never count for anyone.
            </p>
            <p>
              Reporting an error in a profile earns a few extra lookups as a thank-you.
            </p>
          </section>

          <hr className="border-gray-200" />

          <section>
            <h2 className="font-serif text-2xl font-bold text-[#1e293b] mb-6">Transparency</h2>

            <p className="mb-4">
              I want to be upfront about the money side of this. Scholar Folio is not a business. It is an open
              academic project that costs money to run. Here is what has come in and where it goes.
            </p>

            <p className="mb-6">
              If there is ever a surplus after covering API and hosting costs, it gets donated to open science
              initiatives. That commitment is here from day one, even though the amounts are currently tiny.
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
                    <td className="px-4 py-3 border-b border-gray-100">Voluntary support received</td>
                    <td className="px-4 py-3 border-b border-gray-100">
                      {report ? (
                        <>&euro;{(report.revenue_cents / 100).toFixed(2)} <span className="text-[#64748b]">({report.purchase_count} voluntary contribution{report.purchase_count !== 1 ? 's' : ''})</span></>
                      ) : reportFailed ? (
                        <span className="text-[#64748b] italic">Temporarily unavailable</span>
                      ) : (
                        <span className="text-[#64748b] italic">Loading…</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 border-b border-gray-100">Total Costs (API + Hosting)</td>
                    <td className="px-4 py-3 border-b border-gray-100 text-[#64748b]">Exceeds revenue — Google Scholar API, domain</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 border-b border-gray-100">Surplus</td>
                    <td className="px-4 py-3 border-b border-gray-100">&euro;0.00</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Donated To</td>
                    <td className="px-4 py-3 text-[#64748b]">Nothing yet — donations start once a surplus exists</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm text-[#94a3b8] italic mt-4">
              {report
                ? `Figures through ${quarterLabel(report.through)}, covering all sales since launch${report.first_purchase ? ` (first purchase ${new Date(report.first_purchase).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })})` : ''}. `
                : 'Figures cover all sales since launch through the last completed quarter. '}
              Updated automatically each quarter, straight from the payment records.
              Amounts are gross; Stripe&apos;s processing fees are not yet deducted.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
