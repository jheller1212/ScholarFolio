import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Search, ArrowLeft, BookOpen, Users, LineChart, Network, BarChart as ChartBar, User, Unlock, Heart, BadgeCheck, Globe, FileText, MessageSquare, MapPin, AlertTriangle } from 'lucide-react';
import { EmbedModal } from './EmbedModal';
import { ClaimProfileModal } from './ClaimProfileModal';
import { ClaimProfileBar } from './ClaimProfileBar';
import { ProfileCorrectionModal } from './ProfileCorrectionModal';
// pdfExport is dynamically imported on click to avoid bundling jsPDF (344KB)
import { ScholarSearchModal } from './ScholarSearchModal';
import { TopicsList } from './TopicsList';
import { PublicationsList } from './PublicationsList';
import { ProfileMetricsTab } from './ProfileMetricsTab';
import { HeroMetrics } from './HeroMetrics';
import { ProfileTabs, type ProfileTab } from './ProfileTabs';
import { ProfileActions } from './ProfileActions';
import { ResearcherNarrative } from './ResearcherNarrative';

// Lazy-load heavy tab components (D3, Leaflet, recharts, docx)
const CitationsChart = lazy(() => import('./CitationsChart').then(m => ({ default: m.CitationsChart })));
const CitationNetwork = lazy(() => import('./CitationNetwork').then(m => ({ default: m.CitationNetwork })));
const CoAuthorMap = lazy(() => import('./CoAuthorMap').then(m => ({ default: m.CoAuthorMap })));
const OpenScienceTab = lazy(() => import('./OpenScienceTab').then(m => ({ default: m.OpenScienceTab })));
const NarrativeCvTab = lazy(() => import('./NarrativeCvTab').then(m => ({ default: m.NarrativeCvTab })));
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { readCvPreset, clearCvTabPreset } from '../lib/cvPreset';
import { supabase } from '../lib/supabase';
import type { Author, CoAuthorGeoData } from '../types/scholar';
import type { PIndexResult } from '../services/openalex/pindex';
import { fetchCoAuthorGeoData } from '../services/openalex/coauthor-geo';
import { openCoAuthorProfile } from '../lib/openCoAuthorProfile';
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
  { id: 'metrics', label: 'Impact Metrics', short: 'Metrics', icon: ChartBar },
  { id: 'trends', label: 'Citation Trends', short: 'Trends', icon: LineChart },
  { id: 'network', label: 'Co-author Network', short: 'Network', icon: Network },
  { id: 'worldmap', label: 'World Map', short: 'Map', icon: Globe },
  { id: 'openscience', label: 'Open Science', short: 'Open Science', icon: Unlock },
  { id: 'publications', label: 'Publications', short: 'Publications', icon: BookOpen },
  { id: 'narrativecv', label: 'Narrative CV', short: 'Narrative CV', icon: FileText, beta: true },
] as const satisfies readonly ProfileTab<string>[];

type TabId = typeof tabs[number]['id'];

export function ProfileView({
  data,
  profileUrl,
  onSearch,
  onReset,
  socialLinks,
  authControls,
  onSupport
}: ProfileViewProps) {
  const { user, refreshCredits } = useAuth();
  const feedback = useFeedback(user?.id ?? null);
  // Visitors arriving from a grant guide (/?tab=cv) land on the Narrative CV tab.
  const [activeTab, setActiveTab] = useState<TabId>(() => (readCvPreset()?.openTab ? 'narrativecv' : 'metrics'));
  useEffect(() => { clearCvTabPreset(); }, []);
  const [imgError, setImgError] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  const [tabKey, setTabKey] = useState(0);
  const selectTab = (id: TabId) => { setActiveTab(id); setTabKey(k => k + 1); };
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null);
  const [claimedByCurrentUser, setClaimedByCurrentUser] = useState(false);
  const [claimedVerified, setClaimedVerified] = useState(false);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
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
  // Identity for claiming/correcting — works for both Scholar (bare id) and
  // OpenAlex ("openalex:<id>"). ORCID verification makes claiming safe for both.
  const claimAuthorId = isOpenAlexProfile ? rawUserId : scholarId;

  // Check if this profile has been claimed
  useEffect(() => {
    if (!claimAuthorId) return;
    const checkClaim = async () => {
      const { data: claim } = await supabase
        .from('claimed_profiles')
        .select('slug, user_id, verified')
        .eq('author_id', claimAuthorId)
        .maybeSingle();
      if (claim) {
        setClaimedSlug(claim.slug);
        setClaimedByCurrentUser(user?.id === claim.user_id);
        setClaimedVerified(!!claim.verified);
      } else {
        setClaimedSlug(null);
        setClaimedByCurrentUser(false);
        setClaimedVerified(false);
      }
    };
    checkClaim();
  }, [claimAuthorId, user?.id]);

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
      : `https://scholarfolio.org/scholar/${encodeURIComponent(scholarId || rawUserId)}`;

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

            {/* Auth stays reachable on phones; only the social links collapse */}
            <div className="flex items-center gap-3">
              {authControls}
              <div className="hidden md:flex items-center gap-3">{socialLinks}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <ClaimProfileBar authorId={scholarId} authorName={data.name} onOpenClaim={() => setShowClaimModal(true)} />
        {/* Profile summary card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card p-4 sm:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              {data.imageUrl && !imgError ? (
                <img
                  src={data.imageUrl}
                  alt={data.name}
                  width={64}
                  height={64}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover bg-[#eaf4f4] flex-shrink-0"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-[#eaf4f4] flex items-center justify-center">
                  <User className="h-8 w-8 text-[#2d7d7d]" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-0.5 sm:mb-1 truncate">
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
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.affiliation}</p>
              </div>
            </div>

            {/* Hero numbers come before actions/topics so phones see them first */}
            <HeroMetrics data={data} />
          </div>

          {/* Indented under the name on desktop (avatar 64px + gap 16px) */}
          <div className="mt-3 md:pl-20">
            {isOpenAlexProfile && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-[12px] leading-snug text-amber-800 dark:text-amber-300 max-w-2xl">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Built from <b>OpenAlex</b> because Google Scholar couldn't be reached for this profile. Citation counts, affiliation, and the publication list may be incomplete or differ from Google Scholar.{' '}
                  <button
                    onClick={() => { setHeaderSearchQuery(data.name); setShowSearchModal(true); }}
                    className="font-semibold underline hover:no-underline"
                  >
                    Search Google Scholar
                  </button>
                </span>
              </div>
            )}
            {data.corrections && data.corrections.length > 0 && (
              <p
                className="text-[11px] text-[#2d7d7d] dark:text-[#5ab5a5] mb-2 inline-flex items-center gap-1"
                title={`Corrected at the author's request: ${data.corrections.map(c => c.field.replace(/_/g, ' ')).join(', ')}`}
              >
                <BadgeCheck className="h-3 w-3" />
                Corrected at the author&rsquo;s request
              </p>
            )}
            <ProfileActions
              data={data}
              scholarId={scholarId}
              claimAuthorId={claimAuthorId}
              signedIn={!!user}
              claimedSlug={claimedSlug}
              claimedByCurrentUser={claimedByCurrentUser}
              claimedVerified={claimedVerified}
              prefetchedGeo={prefetchedGeo}
              onEmbed={() => setShowEmbed(true)}
              onClaim={() => setShowClaimModal(true)}
              onCorrect={() => setShowCorrectModal(true)}
            />
            {data.topics && data.topics.length > 0 && (
              <TopicsList topics={data.topics} />
            )}
          </div>

          {/* Researcher Narrative */}
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-700">
            <ResearcherNarrative data={data} geoData={prefetchedGeo} onSearch={onSearch} pIndexResult={pIndexResult} scholarId={scholarId} isOpenAlexProfile={isOpenAlexProfile} />
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

        <ProfileTabs
          tabs={tabs}
          activeTab={activeTab}
          onSelect={selectTab}
          panelIdFor={id => (id === 'metrics' ? 'tabpanel-metrics' : 'tabpanel-content')}
        />

        {/* Tab content */}
        {/* Metrics tab stays mounted (hidden) so P-Index computation survives tab switches */}
        <div id="tabpanel-metrics" role="tabpanel" aria-labelledby="tab-metrics" className={activeTab === 'metrics' ? 'tab-content-enter' : 'hidden'}>
          <ProfileMetricsTab data={data} onPIndexResult={setPIndexResult} isOpenAlexProfile={isOpenAlexProfile} />
        </div>

        <div key={tabKey} id="tabpanel-content" role="tabpanel" aria-labelledby={`tab-${activeTab}`} hidden={activeTab === 'metrics'} className="tab-content-enter">
        <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="h-6 w-6 border-2 border-gray-200 border-t-[#2d7d7d] rounded-full animate-spin" /></div>}>
        {activeTab === 'trends' && (
          <div className="w-full">
            <CitationsChart citationsPerYear={data.metrics.citationsPerYear} citationGraphSource={data.metrics.citationGraphSource} publications={data.publications} />
          </div>
        )}

        {activeTab === 'network' && (
          <div className="w-full">
            <CitationNetwork publications={data.publications} authorName={data.name} fullScreen={true} onCoAuthorClick={name => { openCoAuthorProfile(name, 'scholar-search', 'ProfileView'); }} />
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
          <OpenScienceTab data={data} isOpenAlexProfile={isOpenAlexProfile} />
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
          authorName={data.name}
          profileUrl={claimedSlug
            ? `https://scholarfolio.org/${claimedSlug}`
            : `https://scholarfolio.org/scholar/${encodeURIComponent(scholarId)}`}
        />
      )}

      {showClaimModal && claimAuthorId && data && (
        <ClaimProfileModal
          onClose={() => setShowClaimModal(false)}
          authorId={claimAuthorId}
          authorName={data.name}
          onClaimed={handleClaimed}
          onOpenCorrections={() => setShowCorrectModal(true)}
        />
      )}

      {showCorrectModal && claimAuthorId && data && (
        <ProfileCorrectionModal
          onClose={() => setShowCorrectModal(false)}
          authorId={claimAuthorId}
          currentName={data.name}
          currentAffiliation={data.affiliation}
        />
      )}

      {/* Feedback prompt banner */}
      {feedback.showPromptBanner && user && (
        <FeedbackPromptBanner
          onOpenFeedback={() => feedback.openModal('prompt')}
          onDismiss={feedback.dismissBanner}
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
        />
      )}
    </div>
  );
}
