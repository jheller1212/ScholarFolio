# Changelog

All notable changes to Research Portfolio are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
