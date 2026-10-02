import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MetricsCard, MetricsCardSkeleton } from './MetricsCard';
import { PIndexSection } from './PIndexSection';
import { SourceDiscrepancyNote } from './SourceDiscrepancyNote';
import { extractLastName } from '../utils/names';
import type { Author } from '../types/scholar';
import type { PIndexResult } from '../services/openalex/pindex';

interface ProfileMetricsTabProps {
  data: Author;
  onPIndexResult: (result: PIndexResult | null) => void;
  isOpenAlexProfile: boolean;
}

// On phones only this many impact cards show until "All metrics" is tapped.
// Everything stays mounted (just CSS-hidden) so the P-Index computation and
// count-up state survive the toggle.
const MOBILE_VISIBLE_CARDS = 4;

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

function SectionTitle({ dotClass, children }: { dotClass: string; children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>{children}
    </h3>
  );
}

export function ProfileMetricsTab({ data, onPIndexResult, isOpenAlexProfile }: ProfileMetricsTabProps) {
  const [showAll, setShowAll] = useState(false);
  // Hidden on <sm while collapsed; always visible from sm upward.
  const mobileHidden = showAll ? '' : 'hidden sm:block';

  const { metrics, fieldMetrics, s2Stats } = data;
  const hasInfluential = !!s2Stats && s2Stats.totalInfluentialCitations > 0;

  const impactCards: React.ReactNode[] = [
    <MetricsCard key="cit" title="Total Citations" value={data.totalCitations.toLocaleString()} icon="citations" />,
    <MetricsCard key="h" title="h-index" value={metrics.hIndex} icon="hIndex" />,
    <MetricsCard key="i10" title="i10-index" value={metrics.i10Index} icon="i10Index" />,
    <MetricsCard key="h5" title="h5-index" value={metrics.h5Index} subtitle="Last 5 years" icon="h5Index" />,
    <MetricsCard key="g" title="g-index" value={metrics.gIndex} icon="gIndex" />,
    <MetricsCard key="pubs" title="Publications" value={metrics.totalPublications} icon="publications" />,
    <MetricsCard key="ppy" title="Pubs Per Year" value={metrics.publicationsPerYear} icon="pubsPerYear" />,
    <MetricsCard key="cpp" title="Citations/Paper" value={metrics.avgCitationsPerPaper} icon="avgCitationsPerPaper" />,
    <MetricsCard key="cpy" title="Citations/Year" value={metrics.avgCitationsPerYear} icon="citationsPerYear" />,
    <MetricsCard
      key="growth"
      title="Citation Growth"
      value={`${metrics.citationGrowthRate > 0 ? '+' : ''}${metrics.citationGrowthRate}%`}
      subtitle="3-year avg. growth rate"
      icon="citationGrowth"
    />,
    <MetricsCard
      key="half"
      title="Citation Half-Life"
      value={`${metrics.citationHalfLife} yr${metrics.citationHalfLife !== 1 ? 's' : ''}`}
      subtitle="Years to 50% of citations"
      icon="halfLife"
    />,
    <MetricsCard
      key="gini"
      title="Citation Gini"
      value={metrics.citationGini}
      subtitle={metrics.citationGini >= 0.7 ? 'Concentrated' : metrics.citationGini >= 0.4 ? 'Moderate' : 'Spread evenly'}
      icon="gini"
    />,
    <MetricsCard key="age" title="Citations/Career Yr" value={metrics.ageNormalizedRate} subtitle="Age-normalized rate" icon="ageNormalized" />,
  ];
  if (hasInfluential && s2Stats) {
    impactCards.push(
      <MetricsCard
        key="infl"
        title="Influential Citations"
        value={s2Stats.totalInfluentialCitations}
        subtitle={`${s2Stats.matched} of ${s2Stats.total} papers matched`}
        icon="influential"
      />
    );
  }

  const hasFieldMetrics = !!fieldMetrics && (fieldMetrics.fwci !== null || fieldMetrics.topDecileShare !== null || fieldMetrics.meanCitedness !== null || fieldMetrics.rcrMean !== null);
  const hiddenCount = impactCards.length - MOBILE_VISIBLE_CARDS;

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle dotClass="bg-cat-impact-from">Impact Metrics</SectionTitle>
        <div className={GRID}>
          {impactCards.map((card, i) => (
            // A one-cell grid wrapper (not block/flex) so the card still
            // stretches to the full column width like a bare grid item.
            <div key={i} className={i < MOBILE_VISIBLE_CARDS || showAll ? 'grid' : 'hidden sm:grid'}>
              {card}
            </div>
          ))}
        </div>
        {hasInfluential && (
          <p className={`${mobileHidden} text-[10px] text-gray-400 dark:text-gray-500 mt-1`}>
            Influential Citations from{' '}
            <a href="https://www.semanticscholar.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">Semantic Scholar</a>
            {' '}— counts may differ from Google Scholar as coverage varies.
          </p>
        )}
        <SourceDiscrepancyNote data={data} isOpenAlexProfile={isOpenAlexProfile} className="mt-3" />
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          aria-expanded={showAll}
          className="sm:hidden mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-[#2d7d7d] dark:text-[#5bbdbd] bg-white dark:bg-slate-800 border border-[#2d7d7d]/20 rounded-xl"
        >
          {showAll ? 'Fewer metrics' : `All metrics (${hiddenCount}+ more)`}
          {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {data.fieldMetricsLoading && !fieldMetrics ? (
        <div className={mobileHidden}>
          <SectionTitle dotClass="bg-cat-field-from">Field-Normalized Metrics</SectionTitle>
          <div className={GRID}>
            <MetricsCardSkeleton />
            <MetricsCardSkeleton />
          </div>
        </div>
      ) : hasFieldMetrics && fieldMetrics ? (
        <div className={mobileHidden}>
          <SectionTitle dotClass="bg-cat-field-from">Field-Normalized Metrics</SectionTitle>
          <div className={GRID}>
            {fieldMetrics.fwci !== null && (
              <MetricsCard
                title="FWCI"
                value={fieldMetrics.fwci}
                subtitle={`Median · ${fieldMetrics.fwci >= 1.5 ? 'well above avg' : fieldMetrics.fwci >= 1.0 ? 'above world avg' : 'below world avg'}`}
                icon="fwci"
              />
            )}
            {fieldMetrics.topDecileShare !== null && (
              <MetricsCard
                title="Top 10% Papers"
                value={`${fieldMetrics.topDecileShare}%`}
                subtitle={`Of ${fieldMetrics.topDecileCount} classified paper${fieldMetrics.topDecileCount !== 1 ? 's' : ''}`}
                icon="topDecile"
              />
            )}
            {fieldMetrics.meanCitedness !== null && (
              <MetricsCard title="Mean Journal Impact" value={fieldMetrics.meanCitedness} subtitle="Avg venue citedness" icon="meanIF" />
            )}
            {/* Only render RCR when actually computed — it's sourced from NIH
                iCite which isn't wired up, so a permanent "N/A" card would
                advertise a metric we don't provide. */}
            {fieldMetrics.rcrMean !== null && (
              <MetricsCard
                title="RCR"
                value={fieldMetrics.rcrMean}
                subtitle={`${fieldMetrics.rcrPaperCount} PubMed paper${fieldMetrics.rcrPaperCount !== 1 ? 's' : ''}`}
                icon="rcr"
              />
            )}
          </div>
        </div>
      ) : null}

      <div className={mobileHidden}>
        <PIndexSection authorName={data.name} affiliation={data.affiliation} scrapedPublications={data.publications} onResult={onPIndexResult} />
      </div>

      <div className={mobileHidden}>
        <SectionTitle dotClass="bg-cat-collab-from">Collaboration Metrics</SectionTitle>
        <div className={GRID}>
          <MetricsCard title="Co-authors" value={metrics.totalCoAuthors} icon="coAuthors" />
          <MetricsCard title="Avg Authors/Paper" value={metrics.averageAuthors} icon="avgAuthors" />
          <MetricsCard title="Solo Author Rate" value={`${metrics.soloAuthorScore}%`} icon="soloAuthor" />
          <MetricsCard title="Collaboration Rate" value={`${metrics.collaborationScore}%`} icon="network" />
          <MetricsCard
            title="Top Co-author"
            value={metrics.topCoAuthor ? extractLastName(metrics.topCoAuthor) : 'N/A'}
            subtitle={`${metrics.topCoAuthorPapers} papers`}
            icon="topCoAuthor"
          />
        </div>
      </div>
    </div>
  );
}
