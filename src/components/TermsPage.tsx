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
        <h1 className="font-serif text-4xl font-bold text-[#1e293b] mb-4">Terms of Use</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: June 4, 2026</p>

        <div className="space-y-8 text-[15px] text-[#334155] leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">1. Service Description</h2>
            <p>
              Scholar Folio is a free tool that generates visual academic portfolios from publicly available research data.
              It is provided as-is for personal and academic use. The service is operated by Jonas Heller,
              Assistant Professor at Maastricht University, the Netherlands.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">2. Data Sources</h2>
            <p className="mb-3">
              Scholar Folio aggregates publicly available data from multiple academic data sources:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Google Scholar</strong> (via SerpAPI) — publication lists, citation counts, h-index, and profile information.</li>
              <li><strong>OpenAlex</strong> — open access status, field-normalized citation metrics (FWCI), co-author institution data, and journal-level statistics for the p-index.</li>
              <li><strong>ORCID</strong> — education history, employment records, grants, and awards (when an ORCID identifier is available).</li>
              <li><strong>NIH iCite</strong> — Relative Citation Ratio (RCR) for papers indexed in PubMed.</li>
            </ul>
            <p className="mt-3">
              Scholar Folio is not affiliated with Google, Google Scholar, OpenAlex, ORCID, or NIH.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">3. Accuracy Disclaimer</h2>
            <p>
              Citation counts, metrics, and index figures are retrieved from the sources listed above and may
              differ across databases. The p-index, FWCI, and other derived metrics are computed algorithmically
              and should be interpreted in context. We make no guarantees of accuracy or completeness.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">4. Responsible Use</h2>
            <p className="mb-3">
              This tool is designed for researchers to understand and communicate their own work. It is
              explicitly <strong>not intended</strong> for:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Institutional evaluation, hiring decisions, or performance assessment of researchers.</li>
              <li>Ranking or comparing researchers for employment or promotion decisions.</li>
              <li>Automated scraping or data harvesting beyond personal use.</li>
            </ul>
            <p className="mt-3">
              By using Scholar Folio you agree to use the tool responsibly and in line with the
              principles of responsible research assessment (e.g., DORA, Leiden Manifesto).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">5. Accounts & Credits</h2>
            <p>
              Creating an account is optional. Registered users receive a limited number of free profile lookups.
              Additional lookups can be purchased as credit packs. Payments are processed by Stripe in EUR.
              Credits are non-refundable and non-transferable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">6. Intellectual Property</h2>
            <p>
              The Scholar Folio application is open source. The academic data displayed belongs to the
              original sources and their respective terms of use apply. Generated narratives and visualisations
              are derived works provided for personal academic use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">7. Limitation of Liability</h2>
            <p>
              Scholar Folio is provided "as is" without warranty of any kind. To the maximum extent permitted
              by applicable law, we disclaim all liability for damages arising from the use of this service,
              including but not limited to inaccurate data, service interruptions, or reliance on generated metrics.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">8. Governing Law</h2>
            <p>
              These terms are governed by the laws of the Netherlands. Any disputes shall be submitted to
              the competent courts in Maastricht, the Netherlands. If you are a consumer in the EU, you retain
              any mandatory consumer protection rights under the laws of your country of residence.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">9. Changes</h2>
            <p>
              We may update these terms to reflect changes in the service or legal requirements. Material
              changes will be communicated via the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">10. Contact</h2>
            <p>
              Questions about these terms? Contact:{' '}
              <a href="mailto:info@scholarfolio.org" className="text-[#2d7d7d] hover:underline">info@scholarfolio.org</a>
              {' '}or{' '}
              <a
                href="https://www.linkedin.com/in/hellerjonas/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d7d7d] hover:underline inline-flex items-center gap-1"
              >
                Jonas Heller on LinkedIn <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
