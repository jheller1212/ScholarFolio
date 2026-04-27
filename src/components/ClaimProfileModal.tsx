import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Link, Check, AlertCircle, Loader2, User, FileText, Copy, Mail, Linkedin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ClaimProfileModalProps {
  onClose: () => void;
  authorId: string;
  authorName: string;
  onClaimed: (slug: string) => void;
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug);
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function ClaimProfileModal({ onClose, authorId, authorName, onClaimed }: ClaimProfileModalProps) {
  const { user } = useAuth();
  const [slug, setSlug] = useState(() => nameToSlug(authorName));
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingClaim, setExistingClaim] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Check if user already claimed a profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from('claimed_profiles')
      .select('slug')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setExistingClaim(data.slug);
      });
  }, [user]);

  const checkSlugAvailability = useCallback(async (value: string) => {
    if (!isValidSlug(value)) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    const { data, error } = await supabase
      .from('claimed_profiles')
      .select('id')
      .eq('slug', value)
      .maybeSingle();

    if (error) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus(data ? 'taken' : 'available');
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!slug || slug.length < 3) {
      setSlugStatus(slug.length > 0 ? 'invalid' : 'idle');
      return;
    }

    debounceRef.current = setTimeout(() => {
      checkSlugAvailability(slug);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [slug, checkSlugAvailability]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(value.slice(0, 40));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!user || slugStatus !== 'available') return;

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase
      .from('claimed_profiles')
      .insert({
        user_id: user.id,
        author_id: authorId,
        slug,
        display_name: displayName || null,
        bio: bio || null,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        setError('This URL is already taken. Please choose another.');
        setSlugStatus('taken');
      } else {
        setError(insertError.message);
      }
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    // Confetti burst
    const colors = ['#2d7d7d', '#3d9494', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = `${Math.random() * 100}vw`;
      el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDelay = `${Math.random() * 0.5}s`;
      el.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }
    setTimeout(() => {
      onClaimed(slug);
    }, 2500);
  };

  const slugStatusIndicator = () => {
    switch (slugStatus) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
      case 'available':
        return <Check className="h-4 w-4 text-emerald-500" />;
      case 'taken':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const slugStatusMessage = () => {
    switch (slugStatus) {
      case 'available':
        return <span className="text-emerald-600 text-xs">Available</span>;
      case 'taken':
        return <span className="text-red-600 text-xs">Already taken</span>;
      case 'invalid':
        return (
          <span className="text-amber-600 text-xs">
            Must be 3-40 characters, lowercase letters, numbers, and hyphens only
          </span>
        );
      default:
        return null;
    }
  };

  if (existingClaim) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-overlay" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden modal-card"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Already claimed a profile</h2>
            <p className="text-sm text-gray-600 mb-3">
              You already have a claimed profile at{' '}
              <a href={`/${existingClaim}`} className="font-medium text-[#2d7d7d] hover:underline">
                scholarfolio.org/{existingClaim}
              </a>
            </p>
            <p className="text-xs text-gray-400">Each account can claim one profile.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const profileUrl = `https://scholarfolio.org/${slug}`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    });
  };

  if (success) {
    const emailSigHtml = `<a href="${profileUrl}">${authorName} — Research Profile</a>`;
    const linkedInText = `I just claimed my research portfolio on Scholar Folio — citations, collaboration network, and open access stats on one page.\n\nCheck it out: ${profileUrl}`;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 text-center border-b border-gray-100">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Claimed!</h2>
            <p className="text-sm text-gray-600">
              Your profile is live at{' '}
              <a href={`/${slug}`} className="font-medium text-[#2d7d7d] hover:underline">scholarfolio.org/{slug}</a>
            </p>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Share your profile</p>

            {/* Copy URL */}
            <button
              onClick={() => copyToClipboard(profileUrl, 'url')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#2d7d7d]/30 hover:bg-[#eaf4f4]/30 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0">
                <Copy className="h-4 w-4 text-[#2d7d7d]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Copy profile link</p>
                <p className="text-xs text-gray-500 truncate">{profileUrl}</p>
              </div>
              {copiedSnippet === 'url' && <span className="text-xs text-emerald-600 font-medium">Copied!</span>}
            </button>

            {/* Email signature */}
            <button
              onClick={() => copyToClipboard(emailSigHtml, 'email')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#2d7d7d]/30 hover:bg-[#eaf4f4]/30 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-[#2d7d7d]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Email signature snippet</p>
                <p className="text-xs text-gray-500">HTML link for your email signature</p>
              </div>
              {copiedSnippet === 'email' && <span className="text-xs text-emerald-600 font-medium">Copied!</span>}
            </button>

            {/* LinkedIn post */}
            <button
              onClick={() => copyToClipboard(linkedInText, 'linkedin')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#2d7d7d]/30 hover:bg-[#eaf4f4]/30 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#eaf4f4] flex items-center justify-center flex-shrink-0">
                <Linkedin className="h-4 w-4 text-[#2d7d7d]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">LinkedIn post</p>
                <p className="text-xs text-gray-500">Ready-to-post text with your link</p>
              </div>
              {copiedSnippet === 'linkedin' && <span className="text-xs text-emerald-600 font-medium">Copied!</span>}
            </button>
          </div>

          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#2d7d7d] to-[#1a5c5c] px-6 pt-6 pb-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Link className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-white/80">Claim Profile</span>
          </div>
          <h2 className="text-xl font-bold">Get your vanity URL</h2>
          <p className="text-sm text-white/80 mt-1">
            Claim this Scholar profile and share it with a memorable link.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {/* Slug input */}
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
              Your URL
            </label>
            <div className="flex items-center rounded-lg border border-gray-300 focus-within:border-[#2d7d7d] focus-within:ring-1 focus-within:ring-[#2d7d7d] transition-colors bg-white overflow-hidden">
              <span className="pl-3 pr-1 text-sm text-gray-400 whitespace-nowrap select-none">
                scholarfolio.org/
              </span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="your-name"
                className="flex-1 py-2.5 pr-2 text-sm text-gray-900 bg-transparent outline-none min-w-0"
                maxLength={40}
              />
              <div className="pr-3 flex items-center">
                {slugStatusIndicator()}
              </div>
            </div>
            <div className="mt-1 min-h-[1.25rem]">
              {slugStatusMessage()}
            </div>
          </div>

          {/* Display name */}
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-gray-400" />
                Display name
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </span>
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={authorName}
              className="w-full px-3 py-2.5 text-sm text-gray-900 rounded-lg border border-gray-300 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none transition-colors"
              maxLength={100}
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                Bio
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </span>
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="A short bio about your research..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm text-gray-900 rounded-lg border border-gray-300 focus:border-[#2d7d7d] focus:ring-1 focus:ring-[#2d7d7d] outline-none transition-colors resize-none"
              maxLength={500}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || slugStatus !== 'available' || !user}
            className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#2d7d7d] text-white hover:bg-[#1f5c5c] shadow-md shadow-[#2d7d7d]/20 hover:shadow-lg hover:shadow-[#2d7d7d]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Claiming...
              </span>
            ) : (
              'Claim this profile'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
