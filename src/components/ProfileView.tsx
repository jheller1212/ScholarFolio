import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowLeft, BookOpen, Users, LineChart, Network, BarChart as ChartBar, User, Share2, Check, Code, Download, Unlock, ExternalLink, Heart, BadgeCheck, Link, Globe } from 'lucide-react';
import { EmbedModal } from './EmbedModal';
import { ClaimProfileModal } from './ClaimProfileModal';
import { exportProfilePdf } from '../utils/pdfExport';
import { SearchBar } from './SearchBar';
import { TopicsList } from './TopicsList';
import { PublicationsList } from './PublicationsList';
import { CitationsChart } from './CitationsChart';
import { MetricsCard } from './MetricsCard';
import { CitationNetwork } from './CitationNetwork';
import { CoAuthorMap } from './CoAuthorMap';
import { OpenScienceTab } from './OpenScienceTab';
import { ResearcherNarrative } from './ResearcherNarrative';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Author } from '../types/scholar';
import { extractLastName } from '../utils/names';
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('metrics');
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
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

  // Extract scholar ID from URL params or profileUrl
  const scholarId = new URLSearchParams(window.location.search).get('user')
    || (profileUrl ? new URL(profileUrl).searchParams.get('user') : null)
    || '';

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

  // Update document title and OG meta tags for link previews
  useEffect(() => {
    if (!data) return;
    const title = `${data.name} — Scholar Folio`;
    const description = `${data.affiliation} · ${data.totalCitations.toLocaleString()} citations · h-index ${data.hIndex} · ${data.publications.length} publications`;
    const url = claimedSlug
      ? `https://scholarfolio.org/${claimedSlug}`
      : `https://scholarfolio.org/?user=${scholarId}`;

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
  }, [data, claimedSlug, scholarId]);

  const handleClaimed = (slug: string) => {
    setClaimedSlug(slug);
    setClaimedByCurrentUser(true);
    setShowClaimModal(false);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!data) return null;

  return (
    <div className="min-h-screen mesh-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-gray-100/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </button>

            <div className="flex items-center gap-2">
              <Logo size={24} />
              <span className="font-semibold text-sm text-gray-900 hidden sm:inline">Scholar Folio</span>
              <span className="text-[10px] font-medium text-primary-start bg-primary-start/8 px-1.5 py-0.5 rounded hidden sm:inline">
                v{packageJson.version}
              </span>
              <span className="text-[9px] text-transparent hidden sm:inline select-all" title="Build time">
                {new Date(__BUILD_TIME__).toLocaleString()}
              </span>
            </div>

            <div className="flex-1 max-w-md ml-auto">
              <SearchBar onSearch={onSearch} isLoading={loading} error={error} compact={true} />
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
                  className="w-16 h-16 rounded-xl object-cover bg-[#eaf4f4] flex-shrink-0"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-[#eaf4f4] flex items-center justify-center">
                  <User className="h-8 w-8 text-[#2d7d7d]" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 mb-1 truncate">
                  {profileUrl ? (
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
                <p className="text-sm text-gray-500 mb-2">{data.affiliation}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] hover:text-[#1a5c5c] bg-[#eaf4f4] hover:bg-[#d5ecec] px-2.5 py-1 rounded-full transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                    {copied ? 'Link copied!' : 'Share profile'}
                  </button>
                  {scholarId && (
                    <button
                      onClick={() => setShowEmbed(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] hover:text-[#1a5c5c] bg-[#eaf4f4] hover:bg-[#d5ecec] px-2.5 py-1 rounded-full transition-colors"
                    >
                      <Code className="h-3 w-3" />
                      Embed
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!data) return;
                      exportProfilePdf(data, scholarId || undefined);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] hover:text-[#1a5c5c] bg-[#eaf4f4] hover:bg-[#d5ecec] px-2.5 py-1 rounded-full transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                  {claimedSlug ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
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
                      className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] hover:text-[#1a5c5c] bg-[#eaf4f4] hover:bg-[#d5ecec] px-2.5 py-1 rounded-full transition-colors"
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
                  <div className="text-xs text-gray-400 font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Researcher Narrative */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <ResearcherNarrative data={data} />
          </div>
        </div>

        {onSupport && (
          <div className="bg-white rounded-xl border border-[#2d7d7d]/15 shadow-card p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0">
                <Heart className="h-4 w-4 text-[#2d7d7d]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Support open research tools</p>
                <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
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

        {/* Tabs */}
        <div className="mb-6">
          <div className="relative flex gap-1 p-1 bg-gray-100/80 dark:bg-slate-800 rounded-xl w-fit">
            {/* Sliding indicator */}
            <div
              className="tab-indicator absolute top-1 h-[calc(100%-8px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm z-0"
              style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
            />
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={el => { tabsRef.current[i] = el; }}
                onClick={() => { setActiveTab(tab.id); setTabKey(k => k + 1); }}
                className={`relative z-10 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div key={tabKey} className="tab-content-enter">
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Impact Metrics</h3>
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
              </div>
            </div>

            {data.fieldMetrics && (data.fieldMetrics.fwci !== null || data.fieldMetrics.meanCitedness !== null || data.fieldMetrics.rcrMean !== null) && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Field-Normalized Metrics</h3>
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
                  <MetricsCard
                    title="RCR"
                    value={data.fieldMetrics.rcrMean !== null ? data.fieldMetrics.rcrMean : 'N/A'}
                    subtitle={data.fieldMetrics.rcrMean !== null ? `${data.fieldMetrics.rcrPaperCount} PubMed paper${data.fieldMetrics.rcrPaperCount !== 1 ? 's' : ''}` : 'PubMed papers only'}
                    icon="rcr"
                  />
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Collaboration Metrics</h3>
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
        )}

        {activeTab === 'trends' && (
          <div className="w-full">
            <CitationsChart citationsPerYear={data.metrics.citationsPerYear} citationGraphSource={data.metrics.citationGraphSource} publications={data.publications} />
          </div>
        )}

        {activeTab === 'network' && (
          <div className="w-full">
            <CitationNetwork publications={data.publications} fullScreen={true} />
          </div>
        )}

        {activeTab === 'worldmap' && (
          <CoAuthorMap
            publications={data.publications}
            authorName={data.name}
            authorAffiliation={data.affiliation}
          />
        )}

        {activeTab === 'openscience' && (
          <OpenScienceTab data={data} />
        )}

        {activeTab === 'publications' && (
          <PublicationsList publications={data.publications} openAccess={data.openAccess} />
        )}
        </div>
      </main>

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
    </div>
  );
}
