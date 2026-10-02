import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
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
import { NarrativeProvenance } from './NarrativeProvenance';
import type { Author, CoAuthorGeoData } from '../types/scholar';
import type { PIndexResult } from '../services/openalex/pindex';

interface ResearcherNarrativeProps {
  data: Author;
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null;
  onSearch?: (url: string) => void;
  pIndexResult?: PIndexResult | null;
  /** Scholar id (empty for OpenAlex fallback profiles); used for the data date. */
  scholarId: string;
  isOpenAlexProfile: boolean;
}

export function ResearcherNarrative({ data, geoData, onSearch, pIndexResult, scholarId, isOpenAlexProfile }: ResearcherNarrativeProps) {
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
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-3">
        <FileText className="h-4 w-4 text-[#2d7d7d] mr-2" />
        Research Profile
      </h3>

      <NarrativeBody narrative={narrative} extras={extras} linkifyText={linkifyText} />

      <NarrativeProvenance
        scholarId={scholarId}
        isOpenAlexProfile={isOpenAlexProfile}
        freshFetch={data.cacheStatus === 'miss'}
        onSuggestCorrection={() => setShowReport(v => !v)}
        correctionOpen={showReport}
      />

      {showReport && (
        <div className="mt-3">
          <NarrativeReportPanel authorName={data.name} onClose={() => setShowReport(false)} />
        </div>
      )}
    </div>
  );
}
