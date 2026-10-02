// Release notes, one block per shipped batch. `date` is the ISO day the batch
// finished shipping (from the merge dates in git history). Absolute dates only:
// relative labels like "this week" silently go stale once nobody edits the page.

export type ChangelogIcon = 'sparkles' | 'wrench' | 'shield' | 'zap' | 'globe' | 'file' | 'chart' | 'users' | 'eye' | 'book' | 'search' | 'heart';
export type ChangelogTag = 'new' | 'fix' | 'improved';

export interface ChangelogEntry {
  icon: ChangelogIcon;
  text: string;
  tag?: ChangelogTag;
}

export interface ChangelogRelease {
  date: string;
  headline: string;
  entries: ChangelogEntry[];
}

const MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "2026-09-30" → "Sep 30, 2026". Parsed as UTC so no visitor's timezone shifts the day. */
export function formatReleaseDate(isoDay: string): string {
  return MONTH_DAY_YEAR.format(new Date(`${isoDay}T00:00:00Z`));
}

/** Newest first, whatever order the entries were written in. */
export function sortReleases(releases: ChangelogRelease[]): ChangelogRelease[] {
  return [...releases].sort((a, b) => b.date.localeCompare(a.date));
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    date: '2026-10-02',
    headline: 'Free and open, with an example to look at first',
    entries: [
      { icon: 'heart', text: 'ScholarFolio is a free, open-source research project. New pages explain the open funding model and how institutions can sustain it', tag: 'new' },
      { icon: 'eye', text: 'The landing page now shows an example portfolio before you search', tag: 'new' },
      { icon: 'search', text: 'Search results show the full affiliation and mark profiles already claimed or ORCID-verified, so namesakes are easier to tell apart. You can also search OpenAlex directly when Google Scholar only finds namesakes', tag: 'improved' },
      { icon: 'users', text: 'Visitors to an unclaimed profile see an “Is this you?” prompt to claim it', tag: 'new' },
      { icon: 'zap', text: 'Profiles on phones lead with the headline metrics, with a collapsible narrative and clearly labelled tabs', tag: 'improved' },
      { icon: 'wrench', text: 'Also: sign-up now explains the confirm-email step and returns you to the profile you were viewing; the claim dialog no longer crashes for people who already claimed a profile', tag: 'fix' },
    ],
  },
  {
    date: '2026-09-30',
    headline: 'One researcher, one profile',
    entries: [
      { icon: 'users', text: 'When OpenAlex splits a researcher across two records, the profile now combines them into one complete page', tag: 'improved' },
      { icon: 'shield', text: 'Verified corrections apply whichever of a researcher’s records is opened', tag: 'fix' },
      { icon: 'chart', text: 'Career span no longer drops genuine early publications', tag: 'fix' },
      { icon: 'wrench', text: 'ORCID sign-in works on older browsers', tag: 'fix' },
    ],
  },
  {
    date: '2026-08-10',
    headline: 'Pronouns, pasted links, sturdier vanity URLs',
    entries: [
      { icon: 'file', text: 'The generated narrative uses the pronouns a researcher has set for themselves', tag: 'new' },
      { icon: 'search', text: 'Pasting a Google Scholar profile link into the name search opens that profile directly', tag: 'improved' },
      { icon: 'globe', text: 'Claimed vanity URLs keep working when Google Scholar is unreachable, falling back to open OpenAlex data', tag: 'fix' },
      { icon: 'wrench', text: 'Also: the app recovers by itself after a new release instead of showing a stale-page error', tag: 'fix' },
    ],
  },
  {
    date: '2026-07-25',
    headline: 'Privacy by default, more accurate co-authors',
    entries: [
      { icon: 'shield', text: 'Fonts, map data and Semantic Scholar requests are now served by ScholarFolio itself, so your visit is not shared with third parties', tag: 'improved' },
      { icon: 'shield', text: 'Data retention is enforced automatically, matching what the privacy policy promises', tag: 'new' },
      { icon: 'users', text: 'Researchers no longer appear as their own top co-author on any tab, and name variants with umlauts or double surnames are matched', tag: 'fix' },
      { icon: 'book', text: 'Fixed a wrong author match that could show 0% open access', tag: 'fix' },
      { icon: 'chart', text: 'Monthly metric snapshots lay the groundwork for tracking how a profile changes over time', tag: 'new' },
    ],
  },
  {
    date: '2026-07-14',
    headline: 'Fresh design, shareable links, citation badge',
    entries: [
      { icon: 'sparkles', text: 'Refreshed design across the site', tag: 'improved' },
      { icon: 'globe', text: 'Canonical profile links (scholarfolio.org/scholar/…) with working share previews on social media', tag: 'new' },
      { icon: 'chart', text: 'Embeddable live citation badge for your website, replacing the old iframe embed', tag: 'new' },
      { icon: 'shield', text: 'Email preferences with explicit consent', tag: 'new' },
    ],
  },
  {
    date: '2026-07-08',
    headline: 'More accurate metrics, profile corrections',
    entries: [
      { icon: 'users', text: 'Co-authorship stats now count peer-reviewed journal articles only — book chapters, books, and datasets no longer inflate your most-frequent-collaborator counts', tag: 'improved' },
      { icon: 'wrench', text: 'Your own name in initials form (e.g. “IJ Smith” for “Irene J. Smith”) is no longer counted as a separate co-author', tag: 'fix' },
      { icon: 'chart', text: 'Publication and citation counts now exclude non-publications (datasets, peer-review records) and merge exact duplicates such as a preprint and its published version', tag: 'improved' },
      { icon: 'globe', text: 'Smarter primary affiliation when the data source lists several institutions — favouring your current, long-standing one over a brief or secondary role', tag: 'improved' },
      { icon: 'shield', text: 'Verified profile corrections — report an error on your profile and we can now apply a reviewed correction that everyone sees', tag: 'new' },
      { icon: 'shield', text: 'Claim your profile with ORCID verification', tag: 'new' },
    ],
  },
  {
    date: '2026-07-02',
    headline: 'Smarter metrics, faster profiles, transparency report',
    entries: [
      { icon: 'chart', text: 'Top 10% Papers metric — the share of your works in the top decile of their field’s citation distribution, as used in the Leiden Ranking', tag: 'new' },
      { icon: 'chart', text: 'FWCI upgraded to OpenAlex’s native field-weighted citation impact, reported as the median across your papers — now comparable across disciplines', tag: 'improved' },
      { icon: 'eye', text: 'Transparency report on the About page now shows real revenue and cost figures, refreshed automatically every quarter', tag: 'new' },
      { icon: 'zap', text: 'Faster profile loads — publication data is fetched once and pages load in parallel', tag: 'improved' },
      { icon: 'wrench', text: 'Mean Journal Impact now displays correctly (it was silently empty), and metric values no longer lose their % or unit at the end of the count-up animation', tag: 'fix' },
      { icon: 'wrench', text: 'Also: more accurate top-venue counts (journal name variants folded together), loading skeletons for field-normalized metrics, and more reliable publication data fetching', tag: 'fix' },
    ],
  },
  {
    date: '2026-06-16',
    headline: 'Fallback profiles, healthier data pipeline',
    entries: [
      { icon: 'book', text: 'Fallback profiles — when Google Scholar is unavailable, a profile can be built from OpenAlex data instead, free to view', tag: 'new' },
      { icon: 'shield', text: 'Data-source health monitoring with failure-rate alerts, so outages get caught early', tag: 'new' },
      { icon: 'wrench', text: 'Cleaner error logging — cancelled requests are no longer reported as errors', tag: 'fix' },
    ],
  },
  {
    date: '2026-06-06',
    headline: 'Semantic Scholar, Narrative CV export, P-Index',
    entries: [
      { icon: 'book', text: 'Semantic Scholar integration — see influential citation counts and AI-generated TLDRs on your publications', tag: 'new' },
      { icon: 'file', text: 'Narrative CV export — one-click Word download formatted for NWO, ERC, and MSCA grants, with ORCID auto-fill', tag: 'new' },
      { icon: 'chart', text: 'P-Index calculator with field-normalized metrics (FWCI, RCR) and publication review step', tag: 'new' },
      { icon: 'shield', text: 'GDPR compliance — account deletion, data export, password reset, and cookie disclosure', tag: 'new' },
      { icon: 'zap', text: '40% smaller bundle, dark mode polish, and keyboard accessibility improvements', tag: 'improved' },
      { icon: 'wrench', text: 'Also: monthly free credit, credits badge redesign, About page rewrite, error logging, staging environment, and various bug fixes', tag: 'fix' },
    ],
  },
  {
    date: '2026-05-22',
    headline: 'Co-author World Map, field metrics',
    entries: [
      { icon: 'globe', text: 'Co-author World Map — interactive globe showing where your collaborators are based, with continent coloring and region presets', tag: 'new' },
      { icon: 'chart', text: 'Field-normalized metrics card — FWCI, mean journal impact, and Relative Citation Ratio', tag: 'new' },
      { icon: 'wrench', text: 'Also: mobile touch support for world map, redesigned user menu, author name deduplication for Dutch/German prefixes, Safari fixes', tag: 'fix' },
    ],
  },
  {
    date: '2026-04-27',
    headline: 'Claim your profile, visual redesign',
    entries: [
      { icon: 'users', text: 'Claim your profile — get a vanity URL (scholarfolio.org/yourname) with verified badge and share snippets', tag: 'new' },
      { icon: 'sparkles', text: 'Visual redesign — skeleton loaders, page transitions, dark mode, and collaboration insights panel', tag: 'improved' },
      { icon: 'wrench', text: 'Also: error reporting for narratives, admin resolution workflow', tag: 'fix' },
    ],
  },
  {
    date: '2026-03-20',
    headline: 'Open Science tab, admin dashboard',
    entries: [
      { icon: 'book', text: 'Open Science tab — per-publication OA badges, interactive OA trend chart, ORCID integration via OpenAlex', tag: 'new' },
      { icon: 'chart', text: 'Admin dashboard with usage analytics and conversion funnel', tag: 'new' },
      { icon: 'wrench', text: 'Also: security hardening, auth flow fixes', tag: 'fix' },
    ],
  },
  {
    date: '2026-03-07',
    headline: 'ScholarFolio launched',
    entries: [
      { icon: 'sparkles', text: 'ScholarFolio launched — paste any Google Scholar URL to generate a visual academic portfolio', tag: 'new' },
      { icon: 'chart', text: 'Impact metrics, citation trends, interactive co-author network, and auto-generated researcher narrative', tag: 'new' },
      { icon: 'book', text: 'Sortable publication list with journal ranking badges and PDF export', tag: 'new' },
    ],
  },
];
