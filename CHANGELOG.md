# Changelog

All notable changes to Scholar Folio are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.14.0] - 2026-07-02

### Added
- Top 10% Papers metric — share of works in the top decile of their field's citation distribution (the Leiden Ranking's PP(top 10%)), from OpenAlex citation-normalized percentiles
- Mean Journal Impact now actually renders: journal 2-year citedness is resolved via batched `/sources` lookups (the source embedded in works results is dehydrated and never carried stats, so the metric had been silently null)
- Loading skeletons for the async Field-Normalized metrics section
- Transparency report on the About page now shows real figures from payment records via a `transparency_report` RPC, refreshed automatically each quarter

### Changed
- FWCI now uses OpenAlex's native per-work field-weighted citation impact (normalized by subfield, year, and publication type), reported as the **median** across papers — previously a year-normalized percentile proxy that wasn't comparable across disciplines
- OpenAlex enrichment consolidated into one shared, memoized works fetch: profile load does one works fetch instead of two, with pages after the first fetched in parallel
- OpenAlex `/venues` calls migrated to `/sources` (endpoint deprecated)
- Venue normalization unified into one canonical normalizer that also folds journal-name abbreviations

### Fixed
- OpenAlex integration restored: all client-side OpenAlex calls now route through the keyed `scholar` edge-function proxy (OpenAlex requires an API key since 2026-02-13), and the temporary outage notice was removed
- Top-venue counts no longer split on trailing-punctuation/whitespace variants of the same journal name
- RCR metric card hidden until the metric is actually computed, instead of showing an empty placeholder
- Metric cards no longer mangle animated values — "53%" froze as "53", "+12%" as "12", and "12 yrs" would have lost its unit; cards now snap to the exact value on the final frame
- A partial or failed works fetch (including an empty page mid-pagination) is no longer cached for the session, so a later profile load retries instead of under-counting all works-derived metrics
- Mean journal citedness is withheld entirely when a journal-stats batch fails, rather than rendering a systematically skewed average

## [0.13.0] - 2026-06-16

### Added
- OpenAlex fallback profiles — when Google Scholar is unavailable, a profile can be built from OpenAlex data instead (`openalex:` id convention, free to view)
- Admin scholar-fetch health panel tracking SerpAPI/scraper/search failure rates, with a SerpAPI fallback-share alert

### Fixed
- Aborted fetches are no longer logged as client errors
- Missing OpenAlex stats reclassified as an analytics signal rather than an error

## [0.10.0] - 2026-03-06

### Added
- SerpAPI fallback: direct Google Scholar scraping when SerpAPI is rate-limited (429) or unavailable
- Custom SVG logo and favicon
- Inter font and mesh gradient background
- Pill-style tab navigation in profile view
- Tailwind card shadow utilities

### Changed
- Overhauled landing page layout and typography
- Modernized profile view with cleaner card design
- Refined metrics cards with improved spacing and borders
- Restricted CORS origins to deployed domain and localhost

### Removed
- Vite default favicon

## [0.9.16] - 2025-01-31

### Added
- Journal ranking badges (SJR, JCR, FT50, ABS, ABDC)
- Extended journal database
- Improved journal matching algorithm

### Changed
- Enhanced journal name normalization
- Improved publication list display
- Updated ranking badge styling

### Fixed
- Journal ranking detection accuracy
- Publication venue parsing

## [0.9.15] - 2025-01-31

### Added
- Year-over-year growth rate display
- Projected growth rate for current year
- Time range selection for citation trends
- Detailed tooltips for all metrics

### Changed
- Optimized citation chart rendering
- Enhanced growth rate display with color coding

### Fixed
- Citation projection calculations
- Growth rate accuracy
- Chart rendering performance

## [0.9.1] - 2025-01-30

### Added
- Scholar profile search modal
- URL validation for Google Scholar profiles
- Loading states and error handling
- Social media links
- Citation trend analysis with projections
- Version indicator

### Changed
- Improved UI transitions
- Enhanced error messages
- Optimized profile data loading

### Fixed
- Citation chart rendering
- Profile image fallback
- Search validation edge cases
