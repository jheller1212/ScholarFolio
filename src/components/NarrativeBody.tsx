import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { leadSentences } from '../lib/narrative/leadSentences';

interface NarrativeBodyProps {
  narrative: string[];
  extras: (string | null | undefined)[];
  linkifyText: (text: string) => React.ReactNode;
}

// How much of the narrative shows before "Read more". Two sentences is enough
// to say who the person is and where they work without pushing the metrics
// below the fold on a phone.
const LEAD_SENTENCES = 2;

/** Render `**bold**` markers and linkify co-author names in plain segments. */
function renderRich(text: string, linkifyText: (t: string) => React.ReactNode): React.ReactNode {
  return text.split(/\*\*(.*?)\*\*/g).map((part, j) =>
    j % 2 === 1
      ? <strong key={j} className="font-semibold text-gray-900 dark:text-gray-100">{part}</strong>
      : <React.Fragment key={j}>{linkifyText(part)}</React.Fragment>
  );
}

/**
 * The narrative renders instantly (no typewriter) and starts collapsed to its
 * opening sentences, so visitors from social links reach the numbers quickly.
 */
export function NarrativeBody({ narrative, extras, linkifyText }: NarrativeBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const presentExtras = useMemo(() => extras.filter((e): e is string => !!e), [extras]);
  const { lead, truncated } = useMemo(() => leadSentences(narrative, LEAD_SENTENCES), [narrative]);
  const canExpand = truncated || presentExtras.length > 0;

  return (
    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
      <div id={bodyId} className="space-y-2">
      {expanded || !canExpand ? (
        <>
          {narrative.map((paragraph, i) => <p key={i}>{renderRich(paragraph, linkifyText)}</p>)}
          {presentExtras.map((extra, i) => <p key={`e${i}`}>{extra}</p>)}
        </>
      ) : (
        <p>{renderRich(lead, linkifyText)}</p>
      )}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="mt-1 inline-flex items-center gap-1 py-1 text-xs font-medium text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1f5c5c] hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}
