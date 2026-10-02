import { useMemo, useState } from 'react';
import { FileText, Flag } from 'lucide-react';
import { pronounsFor } from '../utils/pronouns';
import { generateNarrativeParagraphs } from '../lib/narrative/paragraphs';
import {
  generateOpenAccessParagraph,
  generateFieldMetricsParagraph,
  generateGeoParagraph,
  generateCitationDistributionParagraph,
} from '../lib/narrative/extraParagraphs';
import { useCoAuthorLinkify } from '../hooks/useCoAuthorLinkify';
import { NarrativeBody } from './NarrativeBody';
import { NarrativeReportPanel } from './NarrativeReportPanel';
import type { Author, CoAuthorGeoData } from '../types/scholar';
import type { PIndexResult } from '../services/openalex/pindex';

interface ResearcherNarrativeProps {
  data: Author;
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null;
  onSearch?: (url: string) => void;
  pIndexResult?: PIndexResult | null;
}

export function ResearcherNarrative({ data, geoData, onSearch, pIndexResult }: ResearcherNarrativeProps) {
  const pn = useMemo(() => pronounsFor(data.pronouns), [data.pronouns]);
  const narrative = useMemo(() => generateNarrativeParagraphs(data, pIndexResult), [data, pIndexResult]);
  const oaParagraph = useMemo(() => generateOpenAccessParagraph(data), [data]);
  const fieldMetricsParagraph = useMemo(() => generateFieldMetricsParagraph(data.fieldMetrics, pn), [data.fieldMetrics, pn]);
  const geoParagraph = useMemo(() => generateGeoParagraph(geoData, pn), [geoData, pn]);
  const citationDistParagraph = useMemo(() => generateCitationDistributionParagraph(data.metrics, data.totalCitations, pn), [data.metrics, data.totalCitations, pn]);
  const extras = useMemo(
    () => [fieldMetricsParagraph, citationDistParagraph, geoParagraph, oaParagraph],
    [fieldMetricsParagraph, citationDistParagraph, geoParagraph, oaParagraph]
  );
  const linkifyText = useCoAuthorLinkify(data, !!onSearch);
  const [showReport, setShowReport] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <FileText className="h-4 w-4 text-[#2d7d7d] mr-2" />
          Research Profile
        </h3>
        <button
          onClick={() => setShowReport(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:border-amber-400 transition-colors"
          title="Report an error in this profile — you'll get 3 credits as thanks"
        >
          <Flag className="h-3.5 w-3.5" />
          Report an error
          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">+3 credits</span>
        </button>
      </div>

      {showReport && (
        <NarrativeReportPanel authorName={data.name} onClose={() => setShowReport(false)} />
      )}

      <NarrativeBody narrative={narrative} extras={extras} linkifyText={linkifyText} />
    </div>
  );
}
