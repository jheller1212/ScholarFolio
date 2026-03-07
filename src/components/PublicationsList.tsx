import React, { useState } from 'react';
import { ArrowUpDown, BookOpen, Presentation as Citation, Calendar, Award, Star, TrendingUp } from 'lucide-react';
import type { Publication, JournalRanking } from '../types/scholar';

interface PublicationsListProps {
  publications: Publication[];
}

type SortField = 'year' | 'citations' | 'title';

function JournalRankingBadge({ ranking }: { ranking: JournalRanking }) {
  console.log('[PublicationsList] Rendering badge for ranking:', ranking); // Debug log

  return (
    <div className="flex flex-wrap gap-1.5">
      {ranking.ft50 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
          <Award className="h-3 w-3 mr-0.5" />
          FT50
        </span>
      )}
      {ranking.abs && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#eaf4f4] text-[#2d7d7d]">
          <Star className="h-3 w-3 mr-0.5" />
          ABS {ranking.abs}
        </span>
      )}
      {ranking.sjr && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-100 text-teal-800">
          <TrendingUp className="h-3 w-3 mr-0.5" />
          SJR {ranking.sjr}
        </span>
      )}
      {ranking.abdc && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
          <Star className="h-3 w-3 mr-0.5" />
          ABDC {ranking.abdc}
        </span>
      )}
      {ranking.jcr && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800">
          <TrendingUp className="h-3 w-3 mr-0.5" />
          IF {ranking.jcr}
        </span>
      )}
    </div>
  );
}

export function PublicationsList({ publications }: PublicationsListProps) {
  const [sortField, setSortField] = useState<SortField>('citations');
  
  const handleSort = (field: SortField) => {
    setSortField(field);
  };

  const sortedPublications = [...publications].sort((a, b) => {
    switch (sortField) {
      case 'year':
        return b.year - a.year;
      case 'citations':
        return b.citations - a.citations;
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  // Debug log to check publications data
  console.log('[PublicationsList] Publications:', sortedPublications.map(p => ({
    venue: p.venue,
    ranking: p.journalRanking
  })));

  if (!publications.length) {
    return (
      <div className="bg-white rounded-lg p-6 text-center">
        <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">No publications found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <BookOpen className="h-5 w-5 text-[#2d7d7d] mr-2" />
          Publications ({publications.length})
        </h3>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleSort('citations')}
            className={`text-xs px-2 py-1 rounded ${
              sortField === 'citations'
                ? 'bg-[#eaf4f4] text-[#2d7d7d]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Citations
            <ArrowUpDown className="h-3 w-3 ml-1 inline" />
          </button>
          <button
            onClick={() => handleSort('year')}
            className={`text-xs px-2 py-1 rounded ${
              sortField === 'year'
                ? 'bg-[#eaf4f4] text-[#2d7d7d]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Year
            <ArrowUpDown className="h-3 w-3 ml-1 inline" />
          </button>
          <button
            onClick={() => handleSort('title')}
            className={`text-xs px-2 py-1 rounded ${
              sortField === 'title'
                ? 'bg-[#eaf4f4] text-[#2d7d7d]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Title
            <ArrowUpDown className="h-3 w-3 ml-1 inline" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sortedPublications.map((pub, index) => (
          <div key={index} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
            <a
              href={pub.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start justify-between gap-4 hover:bg-gray-50 rounded p-2 -mx-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 hover:text-[#2d7d7d] mb-1">
                  {pub.title}
                </h4>
                <p className="text-xs text-gray-600 mb-2">
                  {pub.authors.join(', ')}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {pub.year}
                  </span>
                  {pub.venue && (
                    <span className="text-gray-400">{pub.venue}</span>
                  )}
                </div>
                {pub.journalRanking && (
                  <div className="mt-2">
                    <JournalRankingBadge ranking={pub.journalRanking} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center shrink-0 min-w-[60px]">
                <span className="text-lg font-bold text-[#2d7d7d]">{pub.citations.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">citations</span>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}