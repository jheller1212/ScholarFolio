import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Link, Check, AlertCircle, Loader2, User, FileText } from 'lucide-react';
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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
    setTimeout(() => {
      onClaimed(slug);
    }, 1500);
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

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Profile Claimed</h2>
            <p className="text-sm text-gray-600">
              Your profile is now live at{' '}
              <span className="font-medium text-[#2d7d7d]">scholarfolio.org/{slug}</span>
            </p>
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
