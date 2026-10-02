import { useState } from 'react';
import { Check, Copy, Mail, Linkedin, GraduationCap, Code, ChevronRight, CheckCircle2 } from 'lucide-react';
import { badgeUrlFor, badgeEmbedCode } from '../lib/badge';

interface ClaimSuccessProps {
  slug: string;
  authorId: string;
  authorName: string;
  onDone: () => void;
  /** Opens the self-service corrections editor; the checklist hides without it. */
  onOpenCorrections?: () => void;
}

/**
 * The moment after claiming is when a researcher is most willing to spread
 * their link, so the badge and LinkedIn share lead, and the remaining
 * one-off chores (fix details, hide wrong papers) follow as a checklist.
 */
export function ClaimSuccess({ slug, authorId, authorName, onDone, onOpenCorrections }: ClaimSuccessProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const profileUrl = `https://scholarfolio.org/${slug}`;
  const embedCode = badgeEmbedCode(authorId, authorName, profileUrl);
  const linkedInText = `I just claimed my research portfolio on Scholar Folio — citations, collaboration network, and open access stats on one page.\n\nCheck it out: ${profileUrl}`;
  const emailSigHtml = `<a href="${profileUrl}">${authorName.replace(/[<>"&]/g, '')} — Research Profile</a>`;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => { /* clipboard blocked: the text stays visible to copy by hand */ });
  };

  const copiedTag = (id: string) =>
    copied === id ? <span className="text-xs text-emerald-600 font-medium">Copied!</span> : null;

  const checklist = [
    { label: 'Check your name and affiliation', hint: 'Fix a stale title or institution' },
    { label: 'Add your pronouns', hint: 'Used in your narrative CV' },
    { label: "Hide papers that aren't yours", hint: 'Remove misattributed works' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="claim-success-title" onClick={onDone} onKeyDown={e => { if (e.key === 'Escape') onDone(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center border-b border-gray-100 dark:border-gray-800">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 id="claim-success-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Profile claimed!</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your profile is live at{' '}
            <a href={`/${slug}`} className="font-medium text-[#2d7d7d] hover:underline">scholarfolio.org/{slug}</a>
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Primary: the badge */}
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              <Code className="h-4 w-4 text-[#2d7d7d]" /> Add your citation badge
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Paste it on your university page, website or GitHub README. It updates itself and links back here.
            </p>
            <div className="flex items-center justify-center py-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
              <img src={badgeUrlFor(authorId)} alt={`${authorName} on ScholarFolio`} height={20} />
            </div>
            <button
              onClick={() => copy(embedCode, 'badge')}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] transition-colors"
            >
              {copied === 'badge' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === 'badge' ? 'Badge code copied' : 'Copy badge code'}
            </button>
          </section>

          {/* Primary: LinkedIn */}
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              <Linkedin className="h-4 w-4 text-[#2d7d7d]" /> Tell your network
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-line mb-2">{linkedInText}</p>
            <div className="flex gap-2">
              <button
                onClick={() => copy(linkedInText, 'linkedin')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg border border-[#2d7d7d]/30 text-[#2d7d7d] hover:bg-[#eaf4f4] dark:hover:bg-[#2d7d7d]/20 transition-colors"
              >
                {copied === 'linkedin' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'linkedin' ? 'Copied' : 'Copy post'}
              </button>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => copy(linkedInText, 'linkedin')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-[#0a66c2] text-white hover:brightness-110 transition-all"
              >
                <Linkedin className="h-4 w-4" />
                Share on LinkedIn
              </a>
            </div>
          </section>

          {/* Finish your profile */}
          {onOpenCorrections && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Finish your profile</h3>
              <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                {checklist.map(item => (
                  <li key={item.label}>
                    <button onClick={onOpenCorrections} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-gray-900 dark:text-gray-100">{item.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{item.hint}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Secondary share options */}
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">More ways to share</h3>
            <div className="space-y-1">
              <button onClick={() => copy(profileUrl, 'url')} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-left">
                <Copy className="h-4 w-4 text-gray-400" /><span className="flex-1">Copy profile link</span>{copiedTag('url')}
              </button>
              <button onClick={() => copy(emailSigHtml, 'email')} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-left">
                <Mail className="h-4 w-4 text-gray-400" /><span className="flex-1">Email signature snippet</span>{copiedTag('email')}
              </button>
              <button
                onClick={() => {
                  copy(profileUrl, 'scholar');
                  window.open('https://scholar.google.com/citations?view_op=edit_profile', '_blank', 'noopener');
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
              >
                <GraduationCap className="h-4 w-4 text-gray-400" /><span className="flex-1">Set as your Google Scholar homepage</span>{copiedTag('scholar')}
              </button>
            </div>
          </section>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onDone} className="w-full py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
