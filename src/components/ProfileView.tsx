import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Search, ArrowLeft, BookOpen, Users, LineChart, Network, BarChart as ChartBar, User, Share2, Check, Code, Download, Unlock, ExternalLink, Heart, BadgeCheck, Link, Globe, FileText, MessageSquare, Mail, MapPin } from 'lucide-react';
import { EmbedModal } from './EmbedModal';
import { ClaimProfileModal } from './ClaimProfileModal';
// pdfExport is dynamically imported on click to avoid bundling jsPDF (344KB)
import { ScholarSearchModal } from './ScholarSearchModal';
import { TopicsList } from './TopicsList';
import { PublicationsList } from './PublicationsList';
import { MetricsCard, MetricsCardSkeleton } from './MetricsCard';
import { ResearcherNarrative } from './ResearcherNarrative';
import { PIndexSection } from './PIndexSection';

// Lazy-load heavy tab components (D3, Leaflet, recharts, docx)
const CitationsChart = lazy(() => import('./CitationsChart').then(m => ({ default: m.CitationsChart })));
const CitationNetwork = lazy(() => import('./CitationNetwork').then(m => ({ default: m.CitationNetwork })));
const CoAuthorMap = lazy(() => import('./CoAuthorMap').then(m => ({ default: m.CoAuthorMap })));
const OpenScienceTab = lazy(() => import('./OpenScienceTab').then(m => ({ default: m.OpenScienceTab })));
const NarrativeCvTab = lazy(() => import('./NarrativeCvTab').then(m => ({ default: m.NarrativeCvTab })));
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Author, CoAuthorGeoData } from '../types/scholar';
import type { PIndexResult } from '../services/openalex/pindex';
import { fetchCoAuthorGeoData } from '../services/openalex/coauthor-geo';
import { scholarService } from '../services/scholar';
import { extractLastName } from '../utils/names';
import { useFeedback } from '../hooks/useFeedback';
import { FeedbackModal } from './FeedbackModal';
import { FeedbackPromptBanner } from './FeedbackPromptBanner';
import { trackProfileView } from '../services/profile-views';
import packageJson from '../../package.json';

interface ProfileViewProps {
  data: Author | null;
  profileUrl?: string | null;
  loading: boolean;
  error: string | null;
  onSearch: (url: string) => void;
  onReset: () => void;
  socialLinks: React.ReactNode;
  authControls?: React.ReactNode;
  onSupport?: () => void;
}

const tabs = [
  { id: 'metrics', label: 'Impact Metrics', icon: ChartBar },
  { id: 'trends', label: 'Citation Trends', icon: LineChart },
  { id: 'network', label: 'Co-author Network', icon: Network },
  { id: 'worldmap', label: 'World Map', icon: Globe },
  { id: 'openscience', label: 'Open Science', icon: Unlock },
  { id: 'publications', label: 'Publications', icon: BookOpen },
  { id: 'narrativecv', label: 'Narrative CV', icon: FileText },
] as const;

type TabId = typeof tabs[number]['id'];

export function ProfileView({
  data,
  profileUrl,
  loading,
  error,
  onSearch,
  onReset,
  socialLinks,
  authControls,
  onSupport
}: ProfileViewProps) {
  const { user, refreshCredits } = useAuth();
  const feedback = useFeedback(user?.id ?? null);
  const [activeTab, setActiveTab] = useState<TabId>('metrics');
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  useEffect(() => {
    if (exportError) {
      const t = setTimeout(() => setExportError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [exportError]);
  const [tabKey, setTabKey] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    const el = tabsRef.current[idx];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null);
  const [claimedByCurrentUser, setClaimedByCurrentUser] = useState(false);
  const [prefetchedGeo, setPrefetchedGeo] = useState<{ mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null>(null);
  const [pIndexResult, setPIndexResult] = useState<PIndexResult | null>(null);

  // Prefetch co-author geo data as soon as profile loads (don't wait for tab click)
  useEffect(() => {
    if (!data) { setPrefetchedGeo(null); return; }
    let cancelled = false;
    fetchCoAuthorGeoData(data.name, data.affiliation, data.publications).then(result => {
      if (!cancelled) setPrefetchedGeo(result);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [data?.name, data?.affiliation, data?.publications]);

  // Extract scholar ID from URL params or profileUrl.
  // OpenAlex fallback profiles use an "openalex:<id>" token, not a Scholar id —
  // treat them as having no scholarId so Scholar-only features (embed, claim,
  // "view on Google Scholar") stay hidden rather than pointing at a bad id.
  const rawUserId = new URLSearchParams(window.location.search).get('user')
    || (profileUrl && profileUrl.startsWith('http') ? new URL(profileUrl).searchParams.get('user') : null)
    || '';
  const isOpenAlexProfile = rawUserId.startsWith('openalex:') || (!!profileUrl && profileUrl.startsWith('openalex:'));
  const scholarId = isOpenAlexProfile ? '' : rawUserId;

  // Check if this profile has been claimed
  useEffect(() => {
    if (!scholarId) return;
    const checkClaim = async () => {
      const { data: claim } = await supabase
        .from('claimed_profiles')
        .select('slug, user_id')
        .eq('author_id', scholarId)
        .maybeSingle();
      if (claim) {
        setClaimedSlug(claim.slug);
        setClaimedByCurrentUser(user?.id === claim.user_id);
      } else {
        setClaimedSlug(null);
        setClaimedByCurrentUser(false);
      }
    };
    checkClaim();
  }, [scholarId, user?.id]);

  // Track profile views for feedback prompt + trending leaderboard
  useEffect(() => {
    if (scholarId) {
      feedback.trackProfileView(scholarId);
      if (data) {
        trackProfileView(scholarId, data.name, data.affiliation ?? '');
      }
    }
  }, [scholarId, data?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update document title and OG meta tags for link previews
  useEffect(() => {
    if (!data) return;
    const title = `${data.name} — Scholar Folio`;
    const description = `${data.affiliation} · ${data.totalCitations.toLocaleString()} citations · h-index ${data.hIndex} · ${data.publications.length} publications`;
    // OpenAlex profiles have an empty scholarId; fall back to the raw token
    // (openalex:<id>) so link-preview crawlers get a URL that resolves.
    const url = claimedSlug
      ? `https://scholarfolio.org/${claimedSlug}`
      : `https://scholarfolio.org/?user=${scholarId || rawUserId}`;

    document.title = title;

    const setMeta = (attr: string, key: string, value: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (el) {
        el.setAttribute('content', value);
      }
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);

    return () => {
      document.title = 'Scholar Folio — Your research, at a glance';
    };
  }, [data, claimedSlug, scholarId, rawUserId]);

  const handleClaimed = (slug: string) => {
    setClaimedSlug(slug);
    setClaimedByCurrentUser(true);
    setShowClaimModal(false);
  };

  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setShowShareMenu(false);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!data) return null;

  return (
    <div className="min-h-screen mesh-bg overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-gray-100/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>

            <div className="flex items-center gap-2">
              <Logo size={24} />
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 hidden sm:inline">Scholar Folio</span>
              <span className="text-[10px] font-medium text-primary-start bg-primary-start/8 px-1.5 py-0.5 rounded hidden sm:inline">
                v{packageJson.version.replace('-beta', '')} <span className="text-[8px] opacity-60">beta</span>
              </span>
              <span className="text-[9px] text-transparent hidden sm:inline select-all" title="Build time">
                {new Date(__BUILD_TIME__).toLocaleString()}
              </span>
            </div>

            <div className="flex-1 max-w-xs ml-auto">
              <form onSubmit={(e) => { e.preventDefault(); if (headerSearchQuery.trim().length >= 2) { setShowSearchModal(true); } }} className="relative">
                <input
                  type="text"
                  value={headerSearchQuery}
                  onChange={e => setHeaderSearchQuery(e.target.value)}
                  placeholder="Search researcher..."
                  className="w-full py-1.5 pl-8 pr-3 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:border-[#2d7d7d] focus:ring-2 focus:ring-[#2d7d7d]/20 transition-all"
                  autoComplete="off"
                  spellCheck="false"
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              </form>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {authControls}
              {socialLinks}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Profile summary card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {data.imageUrl && !imgError ? (
                <img
                  src={data.imageUrl}
                  alt={data.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-xl object-cover bg-[#eaf4f4] flex-shrink-0"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-[#eaf4f4] flex items-center justify-center">
                  <User className="h-8 w-8 text-[#2d7d7d]" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 truncate">
                  {profileUrl && !isOpenAlexProfile ? (
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#2d7d7d] transition-colors"
                      title="View on Google Scholar"
                    >
                      {data.name}
                    </a>
                  ) : (
                    data.name
                  )}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{data.affiliation}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                      {copied ? 'Link copied!' : 'Share profile'}
                    </button>
                    {showShareMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                        <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 min-w-[180px]">
                          <button onClick={handleShare} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                            <Link className="h-3 w-3" /> Copy link
                          </button>
                          <button onClick={() => {
                            const text = `Check out ${data.name}'s research profile on ScholarFolio`;
                            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400');
                            setShowShareMenu(false);
                          }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                            <ExternalLink className="h-3 w-3" /> Share on LinkedIn
                          </button>
                          <button onClick={() => {
                            const text = `${data.name}'s research profile — ${data.totalCitations.toLocaleString()} citations, h-index ${data.hIndex}`;
                            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400');
                            setShowShareMenu(false);
                          }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                            <ExternalLink className="h-3 w-3" /> Share on X
                          </button>
                          <button onClick={() => {
                            const subject = `${data.name} — Research Profile`;
                            const body = `Check out ${data.name}'s research profile on ScholarFolio:\n\n${data.affiliation}\n${data.totalCitations.toLocaleString()} citations · h-index ${data.hIndex}\n\n${window.location.href}`;
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                            setShowShareMenu(false);
                          }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                            <Mail className="h-3 w-3" /> Send via email
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {scholarId && (
                    <button
                      onClick={() => setShowEmbed(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors"
                    >
                      <Code className="h-3 w-3" />
                      Embed
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!data || exportingPdf) return;
                      setExportingPdf(true);
                      try {
                        const { exportProfilePdf } = await import('../utils/pdfExport');
                        await exportProfilePdf(data, scholarId || undefined, prefetchedGeo);
                      } catch (err) {
                        const { logCaughtError } = await import('../lib/errorLogger');
                        logCaughtError(err, 'profile', 'ProfileView', 'export-pdf');
                        setExportError('PDF export failed. Please try again. (SF-PDF)');
                      } finally {
                        setExportingPdf(false);
                      }
                    }}
                    disabled={exportingPdf}
                    className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                  >
                    <Download className="h-3 w-3" />
                    {exportingPdf ? 'Exporting...' : 'PDF'}
                  </button>
                  {claimedSlug ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full font-medium">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {claimedByCurrentUser ? (
                        <a href={`/${claimedSlug}`} className="hover:underline">scholarfolio.org/{claimedSlug}</a>
                      ) : (
                        'Verified profile'
                      )}
                    </span>
                  ) : user && scholarId ? (
                    <button
                      onClick={() => setShowClaimModal(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors"
                    >
                      <Link className="h-3 w-3" />
                      Claim profile
                    </button>
                  ) : null}
                  {data.openAccess?.orcid && (
                    <a
                      href={`https://orcid.org/${data.openAccess.orcid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#a6ce39] hover:text-[#8ab52f] bg-[#f3f9e8] hover:bg-[#e8f2d4] px-2.5 py-1 rounded-full transition-colors font-medium"
                      title="View ORCID profile"
                    >
                      <img src="https://info.orcid.org/wp-content/uploads/2019/11/orcid_16x16.png" alt="ORCID" className="h-3 w-3" />
                      ORCID
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {exportError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{exportError}</p>
                )}
                {data.topics && data.topics.length > 0 && (
                  <TopicsList topics={data.topics} />
                )}
              </div>
            </div>

            <div className="flex items-center gap-8 flex-shrink-0">
              {[
                { value: data.totalCitations.toLocaleString(), label: 'Citations' },
                { value: data.hIndex, label: 'h-index' },
                { value: data.publications.length, label: 'Publications' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-2xl font-bold gradient-text">{value}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Researcher Narrative */}
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-700">
            <ResearcherNarrative data={data} geoData={prefetchedGeo} onSearch={onSearch} pIndexResult={pIndexResult} />
          </div>
        </div>

        {onSupport && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#2d7d7d]/15 shadow-card p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0">
                <Heart className="h-4 w-4 text-[#2d7d7d]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Support open research tools</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
                  Scholar Folio is built for researchers, not ranking systems. If this helped you understand or share your research profile, a small contribution helps cover paid Scholar data access.
                </p>
              </div>
            </div>
            <button
              onClick={onSupport}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors whitespace-nowrap"
            >
              <Heart className="h-3.5 w-3.5" />
              Support Scholar Folio
            </button>
          </div>
        )}

        {/* Explore Co-Authors CTA */}
        {data.metrics.totalCoAuthors > 0 && (
          <div className="bg-gradient-to-r from-[#eaf4f4] to-[#e0f0f0] dark:from-[#2d7d7d]/15 dark:to-[#2d7d7d]/10 rounded-xl border border-[#2d7d7d]/10 dark:border-[#2d7d7d]/20 p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Users className="h-4.5 w-4.5 text-[#2d7d7d]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Explore {data.name.split(' ')[0]}'s co-author network</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Discover <strong>{data.metrics.totalCoAuthors}</strong> collaborators across the world map and citation network
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setActiveTab('worldmap'); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors whitespace-nowrap"
                >
                  <MapPin className="h-3 w-3" /> World Map
                </button>
                <button
                  onClick={() => { setActiveTab('network'); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2d7d7d] bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-[#2d7d7d]/20 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Network className="h-3 w-3" /> Network Graph
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="relative flex gap-1 p-1 bg-gray-100/80 dark:bg-slate-800 rounded-xl w-fit" role="tablist">
            {/* Sliding indicator */}
            <div
              className="tab-indicator absolute top-1 h-[calc(100%-8px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm z-0"
              style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
            />
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={el => { tabsRef.current[i] = el; }}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                title={tab.label}
                onClick={() => { setActiveTab(tab.id); setTabKey(k => k + 1); }}
                className={`relative z-10 flex items-center gap-1.5 px-2 sm:px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === 'narrativecv' && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full leading-none">Beta</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {/* Metrics tab stays mounted (hidden) so P-Index computation survives tab switches */}
        <div className={activeTab === 'metrics' ? 'tab-content-enter' : 'hidden'}>
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cat-impact-from"></span>Impact Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <MetricsCard title="Total Citations" value={data.totalCitations.toLocaleString()} icon="citations" />
                <MetricsCard title="h-index" value={data.metrics.hIndex} icon="hIndex" />
                <MetricsCard title="g-index" value={data.metrics.gIndex} icon="gIndex" />
                <MetricsCard title="i10-index" value={data.metrics.i10Index} icon="i10Index" />
                <MetricsCard title="h5-index" value={data.metrics.h5Index} subtitle="Last 5 years" icon="h5Index" />
                <MetricsCard title="Publications" value={data.metrics.totalPublications} icon="publications" />
                <MetricsCard title="Pubs Per Year" value={data.metrics.publicationsPerYear} icon="pubsPerYear" />
                <MetricsCard title="Citations/Paper" value={data.metrics.avgCitationsPerPaper} icon="avgCitationsPerPaper" />
                <MetricsCard title="Citations/Year" value={data.metrics.avgCitationsPerYear} icon="citationsPerYear" />
                <MetricsCard
                  title="Citation Growth"
                  value={`${data.metrics.citationGrowthRate > 0 ? '+' : ''}${data.metrics.citationGrowthRate}%`}
                  subtitle="3-year avg. growth rate"
                  icon="citationGrowth"
                />
                <MetricsCard
                  title="Citation Half-Life"
                  value={`${data.metrics.citationHalfLife} yr${data.metrics.citationHalfLife !== 1 ? 's' : ''}`}
                  subtitle="Years to 50% of citations"
                  icon="halfLife"
                />
                <MetricsCard
                  title="Citation Gini"
                  value={data.metrics.citationGini}
                  subtitle={data.metrics.citationGini >= 0.7 ? 'Concentrated' : data.metrics.citationGini >= 0.4 ? 'Moderate' : 'Spread evenly'}
                  icon="gini"
                />
                <MetricsCard
                  title="Citations/Career Yr"
                  value={data.metrics.ageNormalizedRate}
                  subtitle="Age-normalized rate"
                  icon="ageNormalized"
                />
                {data.s2Stats && data.s2Stats.totalInfluentialCitations > 0 && (
                  <MetricsCard
                    title="Influential Citations"
                    value={data.s2Stats.totalInfluentialCitations}
                    subtitle={`${data.s2Stats.matched} of ${data.s2Stats.total} papers matched`}
                    icon="influential"
                  />
                )}
              </div>
              {data.s2Stats && data.s2Stats.totalInfluentialCitations > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  Influential Citations from{' '}
                  <a href="https://www.semanticscholar.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">Semantic Scholar</a>
                  {' '}— counts may differ from Google Scholar as coverage varies.
                </p>
              )}
            </div>

            {data.fieldMetricsLoading && !data.fieldMetrics ? (
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cat-field-from"></span>Field-Normalized Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  <MetricsCardSkeleton />
                  <MetricsCardSkeleton />
                </div>
              </div>
            ) : (data.fieldMetrics && (data.fieldMetrics.fwci !== null || data.fieldMetrics.meanCitedness !== null || data.fieldMetrics.rcrMean !== null)) ? (
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cat-field-from"></span>Field-Normalized Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {data.fieldMetrics.fwci !== null && (
                    <MetricsCard
                      title="FWCI"
                      value={data.fieldMetrics.fwci}
                      subtitle={data.fieldMetrics.fwci >= 1.5 ? 'Well above average' : data.fieldMetrics.fwci >= 1.0 ? 'Above world average' : 'Below world average'}
                      icon="fwci"
                    />
                  )}
                  {data.fieldMetrics.meanCitedness !== null && (
                    <MetricsCard
                      title="Mean Journal Impact"
                      value={data.fieldMetrics.meanCitedness}
                      subtitle="Avg venue citedness"
                      icon="meanIF"
                    />
                  )}
                  {/* Only render RCR when actually computed — it's currently
                      sourced from NIH iCite which isn't wired up, so showing a
                      permanent "N/A" card advertises a metric we don't provide. */}
                  {data.fieldMetrics.rcrMean !== null && (
                    <MetricsCard
                      title="RCR"
                      value={data.fieldMetrics.rcrMean}
                      subtitle={`${data.fieldMetrics.rcrPaperCount} PubMed paper${data.fieldMetrics.rcrPaperCount !== 1 ? 's' : ''}`}
                      icon="rcr"
                    />
                  )}
                </div>
              </div>
            ) : null}

            {data && (
              <PIndexSection authorName={data.name} affiliation={data.affiliation} scrapedPublications={data.publications} onResult={setPIndexResult} />
            )}

            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cat-collab-from"></span>Collaboration Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <MetricsCard title="Co-authors" value={data.metrics.totalCoAuthors} icon="coAuthors" />
                <MetricsCard title="Avg Authors/Paper" value={data.metrics.averageAuthors} icon="avgAuthors" />
                <MetricsCard title="Solo Author Rate" value={`${data.metrics.soloAuthorScore}%`} icon="soloAuthor" />
                <MetricsCard title="Collaboration Rate" value={`${data.metrics.collaborationScore}%`} icon="network" />
                <MetricsCard
                  title="Top Co-author"
                  value={data.metrics.topCoAuthor ? extractLastName(data.metrics.topCoAuthor) : 'N/A'}
                  subtitle={`${data.metrics.topCoAuthorPapers} papers`}
                  icon="topCoAuthor"
                />
              </div>
            </div>

          </div>
        </div>

        <div key={tabKey} className="tab-content-enter">
        <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="h-6 w-6 border-2 border-gray-200 border-t-[#2d7d7d] rounded-full animate-spin" /></div>}>
        {activeTab === 'trends' && (
          <div className="w-full">
            <CitationsChart citationsPerYear={data.metrics.citationsPerYear} citationGraphSource={data.metrics.citationGraphSource} publications={data.publications} />
          </div>
        )}

        {activeTab === 'network' && (
          <div className="w-full">
            <CitationNetwork publications={data.publications} fullScreen={true} onCoAuthorClick={(name) => {
              const newWindow = window.open('about:blank', '_blank');
              if (newWindow) {
                newWindow.document.write(`<!DOCTYPE html><html><head><title>Scholar Folio</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafa;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}.wrap{text-align:center}.spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#2d7d7d;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}.title{font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px}.sub{font-size:13px;color:#64748b}</style></head><body><div class="wrap"><div class="spinner"></div><div class="title">Loading profile</div><div class="sub">${name.replace(/'/g, '&#39;')}</div></div></body></html>`);
                newWindow.document.close();
              }
              scholarService.searchAuthors(name).then(results => {
                if (results.length >= 1 && newWindow) {
                  newWindow.location.href = `${window.location.origin}?user=${encodeURIComponent(results[0].authorId)}`;
                } else if (newWindow) {
                  newWindow.location.href = `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(name)}`;
                }
              }).catch(() => {
                if (newWindow) {
                  newWindow.location.href = `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(name)}`;
                }
              });
            }} />
          </div>
        )}

        {activeTab === 'worldmap' && (
          <CoAuthorMap
            publications={data.publications}
            authorName={data.name}
            authorAffiliation={data.affiliation}
            prefetchedData={prefetchedGeo}
          />
        )}

        {activeTab === 'openscience' && (
          <OpenScienceTab data={data} />
        )}

        {activeTab === 'publications' && (
          <PublicationsList publications={data.publications} openAccess={data.openAccess} s2Data={data.s2Data} />
        )}

        {activeTab === 'narrativecv' && (
          <NarrativeCvTab data={data} geoData={prefetchedGeo} />
        )}
        </Suspense>
        </div>
      </main>

      <ScholarSearchModal
        isOpen={showSearchModal}
        onClose={() => { setShowSearchModal(false); setHeaderSearchQuery(''); }}
        onSelect={onSearch}
        initialQuery={headerSearchQuery}
      />

      {scholarId && (
        <EmbedModal
          isOpen={showEmbed}
          onClose={() => setShowEmbed(false)}
          scholarId={scholarId}
        />
      )}

      {showClaimModal && scholarId && data && (
        <ClaimProfileModal
          onClose={() => setShowClaimModal(false)}
          authorId={scholarId}
          authorName={data.name}
          onClaimed={handleClaimed}
        />
      )}

      {/* Feedback prompt banner */}
      {feedback.showPromptBanner && user && (
        <FeedbackPromptBanner
          onOpenFeedback={() => feedback.openModal('prompt')}
          onDismiss={feedback.dismissBanner}
          creditsAmount={feedback.hasSubmittedBefore ? 2 : 5}
        />
      )}

      {/* Floating feedback button */}
      {user && !feedback.showPromptBanner && (
        <button
          onClick={() => feedback.openModal('button')}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-full shadow-lg transition-colors"
          aria-label="Share feedback"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Feedback
        </button>
      )}

      {/* Feedback modal */}
      {feedback.showModal && (
        <FeedbackModal
          mode={feedback.modalMode}
          onClose={feedback.closeModal}
          onSuccess={(credits) => {
            feedback.onSubmitSuccess(credits);
            refreshCredits();
          }}
          profileViewed={scholarId}
          isFirstFeedback={!feedback.hasSubmittedBefore}
        />
      )}
    </div>
  );
}
