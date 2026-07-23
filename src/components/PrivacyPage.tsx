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
        <p className="text-sm text-gray-500 mb-10">Last updated: June 9, 2026</p>

        <div className="space-y-8 text-[15px] text-[#334155] leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">1. Data Controller</h2>
            <p>
              Scholar Folio is operated by Jonas Heller, Assistant Professor at Maastricht University, the Netherlands.
              For questions about this policy or your data, contact:{' '}
              <a href="mailto:info@scholarfolio.org" className="text-[#2d7d7d] hover:underline">info@scholarfolio.org</a>.
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
              <li><strong>Usage analytics</strong> — We log anonymised usage events (e.g., page visits, searches, sign-ups) together with the referring URL and any UTM campaign parameters present in the link you followed. Each browser session is assigned a random identifier that is discarded when you close the tab. These events contain no personal identifiers and cannot be linked to you across sessions.</li>
              <li><strong>Email preferences</strong> — If you opt in to email updates (metric change notifications and/or product news), we record your choices together with the consent timestamp, where you gave it, and the exact wording you agreed to. We only send these emails with your consent; you can withdraw it at any time via the account menu or the one-click unsubscribe link included in every email.</li>
              <li><strong>Admin access</strong> — The site administrator may access account-level data (email address, credit balance) for service administration, user support, abuse prevention, and credit adjustments (e.g., granting credits for helpful feedback).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">3. Legal Basis for Processing</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Contract performance</strong> (Art. 6(1)(b) GDPR) — processing your account and purchase data to provide the service you signed up for.</li>
              <li><strong>Legitimate interest</strong> (Art. 6(1)(f) GDPR) — technical logging for rate limiting, abuse prevention, and service stability. We have balanced this interest against your privacy rights and minimise the data collected.</li>
              <li><strong>Legitimate interest</strong> (Art. 6(1)(f) GDPR) — caching publicly available Google Scholar data to provide the core service functionality.</li>
              <li><strong>Legitimate interest</strong> (Art. 6(1)(f) GDPR) — anonymised usage analytics to understand how visitors find and use the service, without tracking individuals across sessions or devices.</li>
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
              <li><strong>OpenAlex</strong> — open academic API used for open access data, field-normalized metrics, co-author geography, and p-index computation. Only public author/work identifiers are queried.</li>
              <li><strong>ORCID</strong> — public API used to retrieve education, employment, and grant records when an ORCID identifier is available. No personal data is sent beyond the public ORCID iD.</li>
              <li><strong>NIH iCite</strong> — public API used to retrieve Relative Citation Ratios for PubMed-indexed papers. Only PubMed identifiers are queried.</li>
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
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">6. International Data Transfers</h2>
            <p className="mb-3">
              Some of our third-party processors are based in the United States. When your personal data is
              transferred outside the European Economic Area (EEA), we ensure appropriate safeguards are in place:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Supabase, Stripe, Netlify, SerpAPI</strong> — transfers are covered by the EU-U.S. Data Privacy Framework and/or EU Standard Contractual Clauses (SCCs) as adopted by the European Commission.</li>
              <li><strong>OpenAlex, ORCID, NIH iCite</strong> — only public academic identifiers are sent to these APIs; no personal data is transferred.</li>
            </ul>
            <p className="mt-3">
              You can request a copy of the applicable transfer safeguards by emailing{' '}
              <a href="mailto:info@scholarfolio.org" className="text-[#2d7d7d] hover:underline">info@scholarfolio.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">7. Your Rights</h2>
            <p className="mb-3">Under the GDPR, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
              <li><strong>Rectification</strong> — correct inaccurate data.</li>
              <li><strong>Erasure</strong> — delete your account and all associated data. You can do this directly from the user menu in the app, or by emailing us.</li>
              <li><strong>Data portability</strong> — download your data in JSON format from the user menu, or request it by email.</li>
              <li><strong>Object</strong> — object to processing based on legitimate interest.</li>
              <li><strong>Complaint</strong> — lodge a complaint with your local data protection authority. In the Netherlands, this is the <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline">Autoriteit Persoonsgegevens</a>.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{' '}
              <a href="mailto:info@scholarfolio.org" className="text-[#2d7d7d] hover:underline">info@scholarfolio.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">8. Cookies & Local Storage</h2>
            <p className="mb-3">
              This site does not use any tracking or advertising cookies.
            </p>
            <p className="mb-3">We use the following strictly necessary cookies:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 mb-3">
              <li><strong>Supabase authentication cookies</strong> — set automatically when you sign in to maintain your login session. These are strictly necessary for the service to function and do not require your consent.</li>
              <li><strong>Stripe payment cookies</strong> (<code>__stripe_mid</code>, <code>__stripe_sid</code>) — set by Stripe only during the checkout flow to process payments securely and prevent fraud. These are strictly necessary for payment processing and are not used for tracking or advertising.</li>
            </ul>
            <p className="mb-3">
              We also use browser localStorage for two strictly functional purposes: storing your theme preference
              (<code>sf_theme</code>) and counting anonymous searches for rate limiting (<code>sf_searches</code>).
              These contain no personal identifiers.
            </p>
            <p>
              We use browser sessionStorage (cleared when you close the tab) to store a random session identifier
              and the referring URL that brought you to the site. This helps us understand how visitors find
              Scholar Folio. The session identifier is a random value that cannot be used to identify you across
              sessions or devices. No personal data is stored in sessionStorage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">9. No Advertising or Data Sales</h2>
            <p>
              We do not use advertising, tracking pixels, or data brokers. We do not sell or share your personal
              data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#1e293b] mb-2">10. Changes to This Policy</h2>
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
