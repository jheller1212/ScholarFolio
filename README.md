# Research Portfolio

Your research, at a glance — publication history, collaboration network, and research reach built from your Google Scholar profile.

**Live:** [scholarmetricsanalyzer.netlify.app](https://scholarmetricsanalyzer.netlify.app/)

## Features

- **Citation analytics** -- h-index, g-index, i10-index, h5-index, citation growth rates
- **Trend visualization** -- yearly citation charts with projections and year-over-year growth
- **Co-author network** -- D3-powered collaboration graph with frequency analysis
- **Publication list** -- sortable table with journal ranking badges (SJR, JCR, FT50, ABS, ABDC)
- **Career analysis** -- publication velocity, collaboration patterns, solo author rate
- **Caching** -- 24-hour Supabase cache to minimize external API calls

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Recharts, D3.js |
| Backend | Supabase Edge Functions (Deno) |
| Data | SerpAPI (primary) with direct Scholar scraping fallback |
| Hosting | Netlify |
| Cache | Supabase PostgreSQL |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project (for the edge function and cache)
- A [SerpAPI](https://serpapi.com) key (optional -- falls back to direct scraping)

### Setup

```bash
git clone https://github.com/JonasHeller1212/ScholarMetricsAnalyzer.git
cd ScholarMetricsAnalyzer
npm install
```

Create a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For the Supabase edge function, set these secrets:

```bash
supabase secrets set SERPAPI_KEY=your-serpapi-key
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
npm test
```

## Architecture

```
src/
  components/     UI components (React + Tailwind)
  services/       API clients and data fetching
  types/          TypeScript interfaces
  utils/          Helper functions
  data/           Static data (metric descriptions, journal rankings)

supabase/
  functions/      Edge function for Scholar data fetching
  migrations/     Database schema (cache table)
```

The edge function tries SerpAPI first. If SerpAPI returns a 429 (rate limit) or 5xx error, it falls back to scraping Google Scholar directly using server-side DOM parsing.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT -- see [LICENSE](LICENSE) for details.
