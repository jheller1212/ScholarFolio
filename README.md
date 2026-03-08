# Scholar Folio

**Your research, at a glance.**

**Live:** (https://scholarfolio.netlify.app/)

Scholar Folio is a free, open-source research portfolio tool. Paste a Google Scholar profile URL and get a clear overview of your publication history, collaboration network, and research reach.

## Features

- **Research Reach** — citation counts, h-index, growth trends
- **Collaboration Network** — co-authorship graph and patterns
- **Publication History** — venue breakdown, timeline, output evolution

## Built by

[Jonas Heller](https://www.linkedin.com/in/hellerjonas/) — Assistant Professor of Marketing, Maastricht University. Research focus: consumer decision-making in emerging technologies (AR, VR, AI).

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
git clone https://github.com/JonasHeller1212/ResearchFolio.git
cd ResearchFolio
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

## Contributing

Contributions welcome. Please open an issue before submitting large PRs.

## License

MIT -- see [LICENSE](LICENSE) for details.
