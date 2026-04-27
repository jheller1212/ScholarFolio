# Scholar Folio

**Claim your research profile. Share it with one link.**

[Live App](https://scholarfolio.org/) | [LinkedIn](https://www.linkedin.com/in/hellerjonas/) | [Report an Issue](https://github.com/JonasHeller1212/ResearchFolio/issues)

Scholar Folio turns a Google Scholar profile into a shareable research portfolio page — citation metrics, collaboration network, open access stats, and a plain-language research narrative. Claim a permanent vanity URL like `scholarfolio.org/your-name` and put it in your email signature, CV, or LinkedIn.

> Numbers here are context, not verdict. Use them to tell your story.

---

## Features

### Claim Your Profile
Sign in, pick a slug, and get a permanent URL. Claimed profiles are always public and free to view — no login needed for visitors. Each claimed profile is served from cache, so it costs nothing to host.

### Research Reach
Citation counts, h-index, g-index, i10-index, h5-index, growth trends, and per-year citation breakdowns. Metrics animate into view with count-up effects.

### Collaboration Network
Interactive co-authorship graph (D3.js) with four view modes: publications, citations, temporal, and cluster detection. Includes collaboration insights — most frequent collaborator, highest-impact collaborator, one-time collaborator analysis, and bridge author detection.

### Open Science
Open access stats via OpenAlex — gold, green, hybrid, bronze breakdown with per-publication OA badges and ORCID linking.

### Citation Trends
Year-by-year citation charts with interactive hover breakdown.

### Publication History
Sortable, filterable table with venue, year, citation counts, and journal rankings (FT50, ABS, SJR).

### Researcher Narrative
Auto-generated plain-language summary of career stage, collaboration patterns, publication venues, and impact trajectory. Users can report errors directly from the profile.

---

## How It Works

1. Paste a Google Scholar profile URL (or search by author name)
2. Scholar Folio fetches profile data via SerpAPI (with direct scraping fallback)
3. Results are cached for 72 hours; claimed profiles serve from cache indefinitely
4. Data is visualized across five tabs: Impact Metrics, Citation Trends, Co-author Network, Open Science, and Publications
5. After viewing, sign in to claim the profile with a vanity URL

### Usage Model

| Tier | Refreshes | Cost |
|------|-----------|------|
| Guest | 5 | Free |
| Signed-up | 5 more | Free |
| Supporter | 25 | EUR 5 |
| Open Science Supporter | 75 | EUR 10 |

Cache hits and claimed profile views don't consume credits. Credits never expire. This is an open science project — supporter packs cover SerpAPI costs, not profit.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Visualization | Recharts (charts), D3.js (network graphs) |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Payments | Stripe Checkout (EUR) |
| Data Sources | SerpAPI (primary), OpenAlex (OA stats), direct scraping (fallback) |
| Hosting | Netlify (auto-deploy on push to main) |

---

## Project Structure

```
src/
  components/         UI components
  contexts/           Auth context (Supabase session + credits)
  services/
    scholar/           Profile fetching, parsing, caching
    openalex/          Open access stats
    metrics/           h-index, g-index, i10-index, collaboration scores
  types/              TypeScript type definitions
  utils/              Name normalization, URL validation, PDF export
  data/               Journal rankings, metric descriptions

supabase/
  functions/
    scholar/           Main data-fetching edge function
    create-checkout/   Stripe checkout session creation
    stripe-webhook/    Payment webhook handler
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `scholar_cache` | Cached profile data with 72-hour TTL |
| `user_credits` | Per-user credit balance (5 free on signup) |
| `credit_purchases` | Stripe purchase records |
| `request_logs` | Usage analytics (user, source, IP, timestamp) |
| `claimed_profiles` | Vanity URL claims (slug, author_id, user_id) |
| `profile_reports` | User-submitted error reports with resolve status |
| `analytics_events` | Page view tracking |

Row-level security is enabled on all tables.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [SerpAPI](https://serpapi.com) key (optional — falls back to direct scraping)
- A [Stripe](https://stripe.com) account (only needed for supporter packs)

### Setup

```bash
git clone https://github.com/JonasHeller1212/ResearchFolio.git
cd ResearchFolio
npm install
```

Create a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Set Supabase edge function secrets:

```bash
supabase secrets set SERPAPI_KEY=your-serpapi-key
supabase secrets set STRIPE_SECRET_KEY=your-stripe-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=your-webhook-signing-secret
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

---

## Key Design Decisions

- **Not a ranking tool** — Terms of Use prohibit using Scholar Folio for evaluating researchers for employment or promotion.
- **Cache hits are free** — Only fresh API calls consume credits. Claimed profiles always serve from cache.
- **One claim per user** — Each account can claim one profile to prevent abuse.
- **Vanity URLs are public** — No login needed to view a claimed profile.
- **Error reporting** — Users can flag inaccuracies in auto-generated narratives. Reports appear in the admin dashboard.
- **Fallback scraping** — If SerpAPI is unavailable, the app falls back to direct HTML scraping.
- **Open science commitment** — Any surplus after costs is donated to open science initiatives. Transparency report published quarterly.

---

## Built By

[Jonas Heller](https://www.linkedin.com/in/hellerjonas/) — Assistant Professor of Marketing, Maastricht University.

---

## Contributing

Contributions welcome. Please open an issue before submitting large PRs.

## License

MIT — see [LICENSE](LICENSE) for details.
