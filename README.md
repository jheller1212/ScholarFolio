# Scholar Folio

**Your research, at a glance.**

[Live App](https://scholarfolio.netlify.app/) | [LinkedIn](https://www.linkedin.com/in/hellerjonas/) | [Report an Issue](https://github.com/JonasHeller1212/ResearchFolio/issues)

Scholar Folio turns a Google Scholar profile URL into a clean, single-page research portfolio. It surfaces your publication history, collaboration network, citation trends, and key impact metrics — without requiring manual data entry.

> Numbers here are context, not verdict. Use them to tell your story.

---

## What It Shows

### Research Reach
Citation counts, h-index, g-index, i10-index, growth trends, and per-year citation breakdowns. Metrics are calculated directly from your Google Scholar data.

### Collaboration Network
Interactive co-authorship graph built with D3.js. See who you've worked with, how often, and how your network has evolved over time.

### Citation Trends
Year-by-year citation charts showing your research trajectory — when your work started gaining traction, which periods saw the most growth.

### Publication History
Sortable, filterable table of all your publications with venue, year, and citation counts. See where you've published and how your output has evolved.

### Researcher Narrative
An auto-generated plain-language summary of your research profile — career stage, collaboration patterns, and impact trajectory.

---

## How It Works

1. Paste a Google Scholar profile URL (or search by author name)
2. Scholar Folio fetches your profile data via SerpAPI (with a direct scraping fallback)
3. Results are cached for 72 hours so repeat visits are instant
4. Data is visualized across four tabs: Impact Metrics, Citation Trends, Co-author Network, and Publications

### Usage Model

| Tier | Searches | Cost |
|------|----------|------|
| Guest | 3 | Free |
| Signed-up | 5 | Free |
| Starter pack | 15 | EUR 5 |
| Pro pack | 40 | EUR 10 |

Cache hits don't consume credits. Credits never expire.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Visualization | Recharts (charts), D3.js (network graphs) |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Payments | Stripe Checkout |
| Data Source | SerpAPI (primary), direct Google Scholar scraping (fallback) |
| Hosting | Netlify |

---

## Project Structure

```
src/
  components/         UI components (27 total)
  contexts/           Auth context (Supabase session + credits)
  services/
    scholar/           Profile fetching, parsing, caching, rate limiting
    metrics/           h-index, g-index, i10-index, collaboration scores
    journal/           Journal ranking lookups
  types/              TypeScript type definitions
  utils/              Name normalization, URL validation, API helpers
  data/               Journal rankings, metric descriptions

supabase/
  functions/
    scholar/           Main data-fetching edge function
    create-checkout/   Stripe checkout session creation
    stripe-webhook/    Payment webhook handler
  migrations/          Database schema (cache, credits, purchases, logs)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [SerpAPI](https://serpapi.com) key (optional — falls back to direct scraping)
- A [Stripe](https://stripe.com) account (only needed for paid credit packs)

### Setup

```bash
git clone https://github.com/JonasHeller1212/ResearchFolio.git
cd ResearchFolio
npm install
```

Create a `.env` file in the project root:

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

### Tests

```bash
npm test                # Run once
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

Tests cover the core metric calculations: h-index, g-index, i10-index, growth metrics, and trend analysis.

---

## Database Schema

The app uses four tables in Supabase PostgreSQL:

- **`scholar_cache`** — Cached profile data with 72-hour TTL
- **`user_credits`** — Per-user credit balance (auto-created on signup with 5 free credits)
- **`credit_purchases`** — Stripe purchase records (idempotent via `stripe_session_id`)
- **`request_logs`** — Usage analytics (user, source, IP, timestamp)

Row-level security is enabled on all tables. Users can only read their own data.

---

## Authentication

- **Email/password** — Requires email confirmation before sign-in
- **Google OAuth** — Instant sign-in, welcome banner shown on first login
- **Terms of Use** — Required checkbox before any sign-up method

New accounts receive 5 free searches. Additional credits can be purchased via Stripe at any time from the credit display in the navbar.

---

## Edge Functions

### `scholar`
Fetches and processes Google Scholar profiles. Handles SerpAPI integration, fallback scraping, caching, rate limiting (10 profiles/hour per IP), credit deduction, and request logging. Supports both profile URL lookups and author name search.

### `create-checkout`
Creates Stripe Checkout sessions for credit pack purchases. Requires JWT authentication.

### `stripe-webhook`
Processes `checkout.session.completed` events. Adds credits to the user's balance with idempotency protection.

---

## Key Design Decisions

- **Cache hits are free** — Only fresh API calls consume credits. This rewards repeat visitors.
- **No institutional use** — The Terms of Use explicitly prohibit using Scholar Folio for ranking, comparing, or evaluating researchers for employment or promotion.
- **Fallback scraping** — If SerpAPI is unavailable or the key isn't set, the app falls back to direct HTML scraping of Google Scholar.
- **Author name normalization** — Handles initials, prefixes (van, de, von), suffixes (Jr., III), and nickname variations to accurately merge co-author data.

---

## Built By

[Jonas Heller](https://www.linkedin.com/in/hellerjonas/) — Assistant Professor of Marketing, Maastricht University. Research focus: consumer decision-making in emerging technologies (AR, VR, AI).

---

## Contributing

Contributions welcome. Please open an issue before submitting large PRs.

## License

MIT — see [LICENSE](LICENSE) for details.
