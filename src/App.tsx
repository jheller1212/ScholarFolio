import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Linkedin, Github, ExternalLink, Moon, Sun } from 'lucide-react';
import { AuthHeaderControls } from './components/AuthHeaderControls';
import { LandingPage } from './components/LandingPage';
import { ApiError } from './utils/api';
import { ErrorModal } from './components/ErrorModal';
import { ProfileView } from './components/ProfileView';
import { AboutPage } from './components/AboutPage';
import { AdminDashboard } from './components/AdminDashboard';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthButton } from './components/AuthButton';
import { CreditPacks } from './components/CreditPacks';
import { SignUpWall } from './components/SignUpWall';
import { ProfileSkeleton } from './components/ProfileSkeleton';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import type { Author } from './types/scholar';
import { scholarService } from './services/scholar';
import { openAlexService } from './services/openalex';

const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/in/hellerjonas/',
  github: 'https://github.com/JonasHeller1212/ResearchFolio'
};

type Page = 'home' | 'about' | 'terms' | 'privacy' | 'admin';

function SocialLinks() {
  return (
    <div className="flex items-center gap-2">
      <DarkModeToggle />
      <a
        href={SOCIAL_LINKS.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-[#2d7d7d] transition-colors"
        title="LinkedIn Profile"
      >
        <Linkedin className="h-4 w-4" />
      </a>
      <a
        href={SOCIAL_LINKS.github}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        title="GitHub"
      >
        <Github className="h-4 w-4" />
      </a>
    </div>
  );
}

function Footer({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [claimedCount, setClaimedCount] = useState(0);

  useEffect(() => {
    supabase.from('claimed_profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count) setClaimedCount(count); });
  }, []);

  return (
    <footer className="bg-[#1e293b] text-white py-10 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-sm text-white/80 mb-4">
          Scholar Folio — Built for researchers, not institutions.
          {claimedCount > 0 && (
            <span className="block text-xs text-white/50 mt-1">
              {claimedCount} {claimedCount === 1 ? 'profile' : 'profiles'} claimed by researchers
            </span>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-6 mb-4">
          <a
            href={SOCIAL_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#3d9494] hover:text-white transition-colors inline-flex items-center gap-1"
          >
            GitHub <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => onNavigate('about')}
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            About
          </button>
          <button
            onClick={() => onNavigate('terms')}
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            Terms
          </button>
          <button
            onClick={() => onNavigate('privacy')}
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            Privacy
          </button>
          <a
            href={SOCIAL_LINKS.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#3d9494] hover:text-white transition-colors inline-flex items-center gap-1"
          >
            LinkedIn <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-white/40">
          &copy; 2025 Jonas Heller. Open source. Made with intent.
        </p>
      </div>
    </footer>
  );
}

function DarkModeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('sf_theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    const saved = localStorage.getItem('sf_theme');
    if (saved === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle dark mode"
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-gray-400" />}
    </button>
  );
}

function AppContent() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Author | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [showCreditPacks, setShowCreditPacks] = useState(false);
  const [showSignUpWall, setShowSignUpWall] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const requestInProgressRef = useRef(false);
  const handleSearchRef = useRef<((url: string, bypassCredits?: boolean, cacheOnly?: boolean) => void) | null>(null);
  const { user, credits, refreshCredits, showWelcome, dismissWelcome } = useAuth();

  // Handle shareable profile URL (?user=AUTHOR_ID) or vanity slug path (e.g. /jonas-heller)
  const [initialUrlHandled, setInitialUrlHandled] = useState(false);
  useEffect(() => {
    if (initialUrlHandled) return;
    setInitialUrlHandled(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('page') === 'admin') {
      setPage('admin');
      return;
    }
    const userParam = params.get('user');
    if (userParam && userParam.length >= 12 && handleSearchRef.current) {
      const scholarUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userParam)}`;
      handleSearchRef.current(scholarUrl, true);
      return;
    }

    // Check for vanity slug in the path (e.g. /jonas-heller)
    const pathSlug = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
    if (pathSlug && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(pathSlug)) {
      supabase
        .from('claimed_profiles')
        .select('author_id')
        .eq('slug', pathSlug)
        .maybeSingle()
        .then(({ data: claim }) => {
          if (claim?.author_id && handleSearchRef.current) {
            const scholarUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(claim.author_id)}`;
            handleSearchRef.current(scholarUrl, true, true);
          }
        });
    }
  }, [initialUrlHandled]);

  // Handle payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      refreshCredits();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshCredits]);

  // Anonymous usage tracking via localStorage
  const getAnonSearches = () => parseInt(localStorage.getItem('sf_searches') || '0');
  const incrementAnonSearches = () => {
    const count = getAnonSearches() + 1;
    localStorage.setItem('sf_searches', String(count));
    return count;
  };
  const ANON_FREE_LIMIT = 5;

  const handleSearch = useCallback(async (url: string, bypassCredits = false, cacheOnly = false) => {
    // Prevent multiple concurrent requests using ref to avoid stale closure
    if (requestInProgressRef.current) {
      return;
    }

    // Credit/usage checks (skip for direct profile links and vanity URLs)
    if (!bypassCredits) {
      if (!user) {
        // Anonymous user — check local free limit
        if (getAnonSearches() >= ANON_FREE_LIMIT) {
          setShowSignUpWall(true);
          return;
        }
      } else if (credits !== null && credits <= 0) {
        setShowCreditPacks(true);
        return;
      }
    }

    try {
      requestInProgressRef.current = true;
      setLoading(true);
      setError(null);
      setData(null);

      const { isValid, userId } = scholarService.validateProfileUrl(url);
      if (!isValid) {
        setError('Invalid Google Scholar URL format. Please enter a valid profile URL.');
        setShowError(true);
        return;
      }

      const profileData = await scholarService.fetchProfile(url, cacheOnly ? { cacheOnly: true } : undefined);
      if (!profileData) {
        setError('Unable to fetch profile data. Please try again later or contact the site administrator.');
        setShowError(true);
        return;
      }

      // Track usage (skip for direct profile links)
      if (!bypassCredits) {
        if (!user) {
          if (profileData.cacheStatus !== 'hit') {
            incrementAnonSearches();
          }
        } else {
          refreshCredits();
        }
      }

      // Ensure metrics exists with default values even if undefined
      const sanitizedData = {
        ...profileData,
        metrics: profileData.metrics ?? { citationsPerYear: {} }
      };

      setProfileUrl(url);
      setData(sanitizedData);

      // Fetch Open Access stats from OpenAlex (non-blocking)
      openAlexService.fetchOpenAccessStats(sanitizedData.name, sanitizedData.affiliation)
        .then(oaStats => {
          if (oaStats) {
            setData(prev => prev ? { ...prev, openAccess: oaStats } : prev);
          }
        })
        .catch(() => {}); // Silently ignore — OA stats are supplementary

      // Update browser URL with shareable link (preserve vanity URL if loaded via slug)
      const pathSlug = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
      const isVanityUrl = pathSlug && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(pathSlug);
      if (!isVanityUrl && userId) {
        window.history.replaceState({}, '', `?user=${encodeURIComponent(userId)}`);
      }
    } catch (err) {
      let errorMessage: string;

      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'An unexpected error occurred';
      }

      setShowError(true);
      setError(errorMessage);
      setData(null);
    } finally {
      requestInProgressRef.current = false;
      setLoading(false);
    }
  }, [user, credits, refreshCredits]);

  // Keep ref in sync for URL-based loading
  handleSearchRef.current = handleSearch;

  const handleReset = useCallback(() => {
    setData(null);
    setProfileUrl(null);
    setError(null);
    setLoading(false);
    requestInProgressRef.current = false;
    setShowError(false);
    setPage('home');
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleNavigate = useCallback((newPage: Page) => {
    setPage(newPage);
    window.scrollTo(0, 0);
  }, []);

  const authControls = (
    <AuthHeaderControls
      onBuyCredits={() => setShowCreditPacks(true)}
      onAdmin={() => handleNavigate('admin')}
      anonSearchesUsed={getAnonSearches()}
      anonFreeLimit={ANON_FREE_LIMIT}
    />
  );

  const renderPage = () => {
    if (page === 'admin') return <div className="page-enter"><AdminDashboard onBack={() => handleNavigate('home')} /></div>;
    if (page === 'about') return <div className="page-enter"><AboutPage onBack={() => handleNavigate('home')} /></div>;
    if (page === 'terms') return <div className="page-enter"><TermsPage onBack={() => handleNavigate('home')} /></div>;
    if (page === 'privacy') return <div className="page-enter"><PrivacyPage onBack={() => handleNavigate('home')} /></div>;

    if (loading && !data) {
      return <ProfileSkeleton />;
    }

    if (data && !error) {
      return (
        <div className="page-enter">
          <ProfileView
            data={data}
            profileUrl={profileUrl}
            loading={loading}
            error={error}
            onSearch={handleSearch}
            onReset={handleReset}
            socialLinks={<SocialLinks />}
            authControls={authControls}
            onSupport={() => setShowCreditPacks(true)}
          />
        </div>
      );
    }

    return <LandingPage onSearch={handleSearch} loading={loading} error={error} onNavigate={handleNavigate} authControls={authControls} />;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Welcome banner for new Google OAuth sign-ups */}
      {showWelcome && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#eaf4f4] border border-[#2d7d7d]/20 text-[#1e293b] px-5 py-3 rounded-xl shadow-lg max-w-sm text-center animate-fade-up">
          <p className="text-sm font-medium mb-1">Welcome to Scholar Folio!</p>
          <p className="text-xs text-gray-600">You have <strong>5 free profile refreshes</strong> to get started.</p>
          <button
            onClick={dismissWelcome}
            className="mt-2 text-xs text-[#2d7d7d] hover:underline font-medium"
          >
            Got it
          </button>
        </div>
      )}
      <div className="flex-1">
        {renderPage()}
      </div>
      {!(data && !error) && <Footer onNavigate={handleNavigate} />}
      {showError && error && (
        <ErrorModal message={error} onClose={handleReset} />
      )}
      {showCreditPacks && (
        <CreditPacks onClose={() => setShowCreditPacks(false)} />
      )}
      {showSignUpWall && (
        <SignUpWall onClose={() => setShowSignUpWall(false)} />
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
