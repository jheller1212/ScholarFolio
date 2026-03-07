import React, { useState } from 'react';
import { Search, ArrowLeft, BookOpen, Users, LineChart, Network, BarChart as ChartBar, User } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { TopicsList } from './TopicsList';
import { PublicationsList } from './PublicationsList';
import { CitationsChart } from './CitationsChart';
import { MetricsCard } from './MetricsCard';
import { CitationNetwork } from './CitationNetwork';
import { ResearcherNarrative } from './ResearcherNarrative';
import { Logo } from './Logo';
import type { Author } from '../types/scholar';
import { extractLastName } from '../utils/names';
import packageJson from '../../package.json';

interface ProfileViewProps {
  data: Author | null;
  loading: boolean;
  error: string | null;
  onSearch: (url: string) => void;
  onReset: () => void;
  socialLinks: React.ReactNode;
}

const tabs = [
  { id: 'metrics', label: 'Impact Metrics', icon: ChartBar },
  { id: 'trends', label: 'Citation Trends', icon: LineChart },
  { id: 'network', label: 'Co-author Network', icon: Network },
  { id: 'publications', label: 'Publications', icon: BookOpen },
] as const;

type TabId = typeof tabs[number]['id'];

export function ProfileView({
  data,
  loading,
  error,
  onSearch,
  onReset,
  socialLinks
}: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('metrics');
  const [imgError, setImgError] = useState(false);

  if (!data) return null;

  return (
    <div className="min-h-screen mesh-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100/80">
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
            </div>

            <div className="flex-1 max-w-md ml-auto">
              <SearchBar onSearch={onSearch} isLoading={loading} error={error} compact={true} />
            </div>

            <div className="hidden md:block">{socialLinks}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Profile summary card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 mb-6">
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
                  {data.name}
                </h2>
                <p className="text-sm text-gray-500 mb-3">{data.affiliation}</p>
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

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-1 p-1 bg-gray-100/80 rounded-xl w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
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
              </div>
            </div>

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
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <CitationsChart citationsPerYear={data.metrics.citationsPerYear} />
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="w-full">
            <CitationNetwork publications={data.publications} fullScreen={true} />
          </div>
        )}

        {activeTab === 'publications' && (
          <PublicationsList publications={data.publications} />
        )}
      </main>
    </div>
  );
}
