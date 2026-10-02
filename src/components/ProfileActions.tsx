import { useEffect, useState } from 'react';
import { Share2, Check, Code, Download, ExternalLink, BadgeCheck, Link, FileText, Mail } from 'lucide-react';
import type { Author, CoAuthorGeoData } from '../types/scholar';

interface ProfileActionsProps {
  data: Author;
  scholarId: string;
  claimAuthorId: string;
  signedIn: boolean;
  claimedSlug: string | null;
  claimedByCurrentUser: boolean;
  claimedVerified: boolean;
  prefetchedGeo: { mainAuthor: CoAuthorGeoData | null; coAuthors: CoAuthorGeoData[] } | null;
  onEmbed: () => void;
  onClaim: () => void;
  onCorrect: () => void;
}

/** Share / embed / PDF / claim pills under the profile name. */
export function ProfileActions({
  data,
  scholarId,
  claimAuthorId,
  signedIn,
  claimedSlug,
  claimedByCurrentUser,
  claimedVerified,
  prefetchedGeo,
  onEmbed,
  onClaim,
  onCorrect,
}: ProfileActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!exportError) return;
    const t = setTimeout(() => setExportError(null), 5000);
    return () => clearTimeout(t);
  }, [exportError]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setShowShareMenu(false);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setShowShareMenu(!showShareMenu)}
          className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
          {copied ? 'Link copied!' : 'Share profile'}
        </button>
        {showShareMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
            <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 min-w-[180px]">
              <button onClick={handleShare} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                <Link className="h-3 w-3" /> Copy link
              </button>
              <button onClick={() => {
                // share-offsite takes only a URL; the card text comes from our OG tags
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400');
                setShowShareMenu(false);
              }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                <ExternalLink className="h-3 w-3" /> Share on LinkedIn
              </button>
              <button onClick={() => {
                const text = `${data.name}'s research profile — ${data.totalCitations.toLocaleString()} citations, h-index ${data.hIndex}`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, '_blank', 'width=600,height=400');
                setShowShareMenu(false);
              }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                <ExternalLink className="h-3 w-3" /> Share on X
              </button>
              <button onClick={() => {
                const subject = `${data.name} — Research Profile`;
                const body = `Check out ${data.name}'s research profile on ScholarFolio:\n\n${data.affiliation}\n${data.totalCitations.toLocaleString()} citations · h-index ${data.hIndex}\n\n${window.location.href}`;
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                setShowShareMenu(false);
              }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                <Mail className="h-3 w-3" /> Send via email
              </button>
            </div>
          </>
        )}
      </div>
      {scholarId && (
        <button
          onClick={onEmbed}
          className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors"
        >
          <Code className="h-3 w-3" />
          Embed
        </button>
      )}
      <button
        onClick={async () => {
          if (!data || exportingPdf) return;
          setExportingPdf(true);
          try {
            const { exportProfilePdf } = await import('../utils/pdfExport');
            await exportProfilePdf(data, scholarId || undefined, prefetchedGeo);
          } catch (err) {
            const { logCaughtError } = await import('../lib/errorLogger');
            logCaughtError(err, 'profile', 'ProfileView', 'export-pdf');
            setExportError('PDF export failed. Please try again. (SF-PDF)');
          } finally {
            setExportingPdf(false);
          }
        }}
        disabled={exportingPdf}
        className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
      >
        <Download className="h-3 w-3" />
        {exportingPdf ? 'Exporting...' : 'PDF'}
      </button>
      {claimedSlug ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full font-medium">
          <BadgeCheck className="h-3.5 w-3.5" />
          {claimedByCurrentUser ? (
            <a href={`/${claimedSlug}`} className="hover:underline">scholarfolio.org/{claimedSlug}</a>
          ) : (
            'Verified profile'
          )}
        </span>
      ) : signedIn && claimAuthorId ? (
        <button
          onClick={onClaim}
          className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors"
        >
          <Link className="h-3 w-3" />
          Claim profile
        </button>
      ) : null}
      {claimedByCurrentUser && claimedVerified && (
        <button
          onClick={onCorrect}
          className="inline-flex items-center gap-1.5 text-xs text-[#2d7d7d] dark:text-[#5bbdbd] hover:text-[#1a5c5c] bg-[#eaf4f4] dark:bg-[#2d7d7d]/20 hover:bg-[#d5ecec] dark:hover:bg-[#2d7d7d]/30 px-2.5 py-1 rounded-full transition-colors"
        >
          <FileText className="h-3 w-3" />
          Edit profile
        </button>
      )}
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
    {exportError && (
      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{exportError}</p>
    )}
    </>
  );
}
