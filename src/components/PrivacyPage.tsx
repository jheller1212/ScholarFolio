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
        <h1 className="font-serif text-4xl font-bold text-[#1e293b] mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: June 3, 2026</p>

        <div className="space-y-8 text-[15px] text-[#334155] leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">1. Data Controller</h2>
            <p>
              Scholar Folio is operated by Jonas Heller, Assistant Professor at Maastricht University, the Netherlands.
              For questions about this policy or your data, contact:{' '}
              <a href="mailto:privacy@scholarfolio.org" className="text-[#2d7d7d] hover:underline">privacy@scholarfolio.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">2. What Data We Collect</h2>
            <p className="mb-3">We collect and process the following categories of personal data:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Account data</strong> — email address and hashed password (when you sign up), or Google account email (when using Google Sign-In).</li>
              <li><strong>Purchase data</strong> — Stripe payment session IDs, credit pack purchased, and amount. We do not store credit card numbers; Stripe handles all payment processing.</li>
              <li><strong>Technical logs</strong> — IP address, user agent, request timestamp, and the Google Scholar profile ID searched. These are used for rate limiting, abuse prevention, and debugging. Logs are automatically deleted after 30 days.</li>
              <li><strong>Local storage</strong> — We store a theme preference (<code>sf_theme</code>) and an anonymous search counter (<code>sf_searches</code>) in your browser's localStorage. These are strictly functional and contain no personal identifiers.</li>
              <li><strong>Cached profile data</strong> — Publicly available Google Scholar profile data (name, affiliation, publications) is cached for up to 7 days to reduce redundant API calls.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">3. Legal Basis for Processing</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Contract performance</strong> (Art. 6(1)(b) GDPR) — processing your account and purchase data to provide the service you signed up for.</li>
              <li><strong>Legitimate interest</strong> (Art. 6(1)(f) GDPR) — technical logging for rate limiting, abuse prevention, and service stability. We have balanced this interest against your privacy rights and minimise the data collected.</li>
              <li><strong>Legitimate interest</strong> (Art. 6(1)(f) GDPR) — caching publicly available Google Scholar data to provide the core service functionality.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">4. Third-Party Processors</h2>
            <p className="mb-3">We use the following third-party services to operate Scholar Folio:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Supabase</strong> (EU/US) — authentication, database hosting, and serverless functions.</li>
              <li><strong>Stripe</strong> (US) — payment processing. Subject to <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline">Stripe's Privacy Policy</a>.</li>
              <li><strong>Netlify</strong> (US) — web hosting and CDN.</li>
              <li><strong>SerpAPI</strong> (US) — Google Scholar data retrieval.</li>
              <li><strong>OpenAlex / ORCID</strong> — public academic APIs used to enrich profile data. No personal data is sent to these services beyond the public identifiers being looked up.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">5. Data Retention</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Account data</strong> — retained until you delete your account.</li>
              <li><strong>Purchase records</strong> — retained for legal/tax compliance (7 years).</li>
              <li><strong>Technical logs</strong> — automatically deleted after 30 days.</li>
              <li><strong>Cached profiles</strong> — expire after 7 days and are periodically cleaned up.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">6. Your Rights</h2>
            <p className="mb-3">Under the GDPR, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
              <li><strong>Rectification</strong> — correct inaccurate data.</li>
              <li><strong>Erasure</strong> — delete your account and all associated data. You can do this directly from the user menu in the app, or by emailing us.</li>
              <li><strong>Data portability</strong> — receive your data in a machine-readable format.</li>
              <li><strong>Object</strong> — object to processing based on legitimate interest.</li>
              <li><strong>Complaint</strong> — lodge a complaint with your local data protection authority. In the Netherlands, this is the <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline">Autoriteit Persoonsgegevens</a>.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{' '}
              <a href="mailto:privacy@scholarfolio.org" className="text-[#2d7d7d] hover:underline">privacy@scholarfolio.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">7. Cookies & Local Storage</h2>
            <p>
              Scholar Folio does not use tracking cookies or third-party analytics. We use browser localStorage
              for two strictly functional purposes: storing your theme preference and counting anonymous searches
              for rate limiting. Supabase authentication uses session tokens stored in localStorage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">8. No Advertising or Data Sales</h2>
            <p>
              We do not use advertising, tracking pixels, or data brokers. We do not sell or share your personal
              data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this policy to reflect changes in our practices or legal requirements. Material
              changes will be communicated via the app. The "last updated" date at the top indicates the
              most recent revision.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
