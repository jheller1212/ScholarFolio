import React, { useState } from 'react';
import { Download, Info, Loader2 } from 'lucide-react';
import { exportNarrativeCv } from '../utils/narrativeCvExport';
import type { NarrativeCvFormat } from '../utils/narrativeCvExport';
import type { Author, CoAuthorGeoData } from '../types/scholar';

interface NarrativeCvTabProps {
  data: Author;
  geoData?: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null;
}

const formats: Array<{
  id: NarrativeCvFormat;
  name: string;
  subtitle: string;
  description: string;
  grants: string;
  metrics: string;
  color: string;
}> = [
  {
    id: 'nwo',
    name: 'NWO Evidence-Based CV',
    subtitle: 'Dutch Research Council',
    description: 'Narrative academic profile + max 10 key outputs. NWO explicitly bans Journal Impact Factors and h-indices — the export strips these automatically.',
    grants: 'Veni, Vidi, Vici, Rubicon, and all other NWO programmes',
    metrics: 'No h-index, no JIF, no citation counts',
    color: 'border-orange-200 bg-orange-50/50',
  },
  {
    id: 'erc',
    name: 'ERC CV & Track Record',
    subtitle: 'European Research Council',
    description: 'Structured CV (4-page target) with 6 sections covering personal info, education, positions, achievements, publications, and a narrative track record. Journal Impact Factors are discouraged, but citation counts are acceptable as evidence.',
    grants: 'Starting Grant, Consolidator Grant, Advanced Grant',
    metrics: 'No JIF; citation counts allowed',
    color: 'border-blue-200 bg-blue-50/50',
  },
  {
    id: 'msca',
    name: 'MSCA Postdoctoral Fellowship CV',
    subtitle: 'Marie Skłodowska-Curie Actions',
    description: 'Part B2 researcher CV for MSCA Postdoctoral Fellowship applications. Focuses on research experience, publications, international mobility, and transferable skills. No strict page limit but should be concise.',
    grants: 'MSCA Postdoctoral Fellowships (European & Global)',
    metrics: 'Citation counts allowed; focus on quality over quantity',
    color: 'border-purple-200 bg-purple-50/50',
  },
];

export function NarrativeCvTab({ data, geoData }: NarrativeCvTabProps) {
  const [exporting, setExporting] = useState<NarrativeCvFormat | null>(null);
  const [showTooltip, setShowTooltip] = useState<NarrativeCvFormat | null>(null);

  const handleExport = async (format: NarrativeCvFormat) => {
    setExporting(format);
    try {
      await exportNarrativeCv(data, format, geoData);
    } catch (err) {
      console.error('Narrative CV export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Narrative CV Export
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Generate an editable Word document (.docx) pre-filled with your profile data, ORCID records, and selected publications.
          Complete the placeholder sections before submission.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {formats.map(fmt => (
          <div
            key={fmt.id}
            className={`relative rounded-xl border-2 ${fmt.color} p-5 transition-shadow hover:shadow-md`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {fmt.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {fmt.subtitle}
                </p>
              </div>
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTooltip(fmt.id)}
                  onMouseLeave={() => setShowTooltip(null)}
                  onClick={() => setShowTooltip(showTooltip === fmt.id ? null : fmt.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={`Info about ${fmt.name}`}
                >
                  <Info className="h-4 w-4" />
                </button>
                {showTooltip === fmt.id && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg p-3 z-50 text-xs">
                    <p className="text-gray-700 dark:text-gray-300 mb-2">{fmt.description}</p>
                    <div className="space-y-1">
                      <p className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Use for:</span> {fmt.grants}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Metrics policy:</span> {fmt.metrics}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">Use for:</span> {fmt.grants}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              <span className="font-medium">Metrics:</span> {fmt.metrics}
            </p>

            <button
              onClick={() => handleExport(fmt.id)}
              disabled={exporting !== null}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2d7d7d] hover:bg-[#246666] disabled:bg-gray-300 dark:disabled:bg-slate-600 rounded-lg transition-colors"
            >
              {exporting === fmt.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export .docx
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
        <p className="font-medium text-gray-700 dark:text-gray-300">What's included automatically:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Research narrative generated from your publication data</li>
          <li>Top 10 publications ranked by journal prestige and citations</li>
          <li>Education, employment, grants, and awards from ORCID (if available)</li>
          <li>Open Access flags on publications</li>
          <li>Placeholder prompts for sections that need manual input</li>
        </ul>
        <p className="mt-2 text-gray-400 dark:text-gray-500 italic">
          Tip: Ensure your ORCID profile is up-to-date for the best auto-fill results.
          The exported document is fully editable in Microsoft Word or Google Docs.
        </p>
      </div>
    </div>
  );
}
