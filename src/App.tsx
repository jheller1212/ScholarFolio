import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Linkedin, Github, ExternalLink } from 'lucide-react';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthHeaderControls } from './components/AuthHeaderControls';
import { LandingPage } from './components/LandingPage';
import { ApiError } from './utils/api';
import { ErrorModal } from './components/ErrorModal';
import { ProfileView } from './components/ProfileView';
import { AboutPage } from './components/AboutPage';
import { AdminDashboard } from './components/AdminDashboard';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';
import { ChangelogPage } from './components/ChangelogPage';
import { TrendingPage } from './components/TrendingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthButton } from './components/AuthButton';
import { CreditPacks } from './components/CreditPacks';
import { SignUpWall } from './components/SignUpWall';
import { ProfileSkeleton } from './components/ProfileSkeleton';
import { PasswordResetModal } from './components/PasswordResetModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { ADMIN_EMAIL } from './lib/constants';
import type { Author } from './types/scholar';
import { scholarService } from './services/scholar';
import { openAlexService, fetchOpenAlexProfile, OPENALEX_ID_PREFIX } from './services/openalex';
import { fetchProfileOverrides, applyProfileOverrides } from './services/corrections';
import { fetchFieldNormalizedMetrics } from './services/openalex/field-metrics';
import { enrichWithSemanticScholar } from './services/semanticscholar';
import { logCaughtError, logError } from './lib/errorLogger';
import { captureAttribution, trackEvent } from './lib/analytics';

const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/in/hellerjonas/',
  github: 'https://github.com/JonasHeller1212/ResearchFolio'
};

type Page = 'home' | 'about' | 'terms' | 'privacy' | 'admin' | 'changelog' | 'trending';

function SocialLinks() {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
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

function Footer({ onNavigate, onSupport }: { onNavigate: (page: Page) => void; onSupport?: () => void }) {
  return (
    <footer className="bg-[#1e293b] text-white py-10 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-sm text-white/80 mb-4">
          Scholar Folio — Built for researchers, not institutions.
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
          <a
            href="/about"
            onClick={(e) => { e.preventDefault(); onNavigate('about'); }}
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            About
          </a>
          <a
            href="/terms"
            onClick={(e) => { e.preventDefault(); onNavigate('terms'); }}
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            Terms
          </a>
          <a
            href="/privacy"
            onClick={(e) => { e.preventDefault(); onNavigate('privacy'); }}
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            Privacy
          </a>
          <a
            href="/changelog"
            onClick={(e) => { e.preventDefault(); onNavigate('changelog'); }}
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            Changelog
          </a>
          <a
            href="mailto:info@scholarfolio.org"
            className="text-sm text-[#3d9494] hover:text-white transition-colors"
          >
            Contact
          </a>
          <a
            href={SOCIAL_LINKS.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#3d9494] hover:text-white transition-colors inline-flex items-center gap-1"
          >
            LinkedIn <ExternalLink className="h-3 w-3" />
          </a>
          {onSupport && (
            <button
              onClick={onSupport}
              className="text-sm text-[#3d9494] hover:text-white transition-colors"
            >
              Support ScholarFolio
            </button>
          )}
        </div>
        <p className="text-xs text-white/40">
          &copy; 2025 Jonas Heller. Open source. Made with intent.
        </p>
      </div>
    </footer>
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
  const { user, credits, refreshCredits, showWelcome, dismissWelcome, showPasswordReset, dismissPasswordReset, updatePassword } = useAuth();
  const [showBonus, setShowBonus] = useState(() => !localStorage.getItem('sf_bonus_seen'));
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Capture referrer + UTM on first load
  useEffect(() => { captureAttribution(); }, []);

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
    // Deep-linkable content pages, reachable at both /privacy and ?page=privacy
    // so they're crawlable/indexable (and can't be shadowed by a vanity slug,
    // which is why this runs before the slug lookup below).
    const PAGE_ROUTES: Page[] = ['about', 'terms', 'privacy', 'changelog', 'trending'];
    const pageParam = params.get('page');
    const pathName = window.location.pathname.replace(/^\//, '').replace(/\/$/, '').toLowerCase();
    const routed = (pageParam && (PAGE_ROUTES as string[]).includes(pageParam))
      ? pageParam
      : ((PAGE_ROUTES as string[]).includes(pathName) ? pathName : null);
    if (routed) {
      setPage(routed as Page);
      return;
    }
    // Handle ORCID OAuth error
    const orcidError = params.get('orcid_error');
    if (orcidError) {
      const url = new URL(window.location.href);
      url.searchParams.delete('orcid_error');
      window.history.replaceState({}, '', url.pathname + url.search);
    }

    // Validate ORCID OAuth state (CSRF protection)
    const orcidState = params.get('orcid_state');
    if (orcidState !== null) {
      const stored = sessionStorage.getItem('orcid_oauth_state');
      sessionStorage.removeItem('orcid_oauth_state');
      const url = new URL(window.location.href);
      url.searchParams.delete('orcid_state');
      window.history.replaceState({}, '', url.pathname + url.search);
      if (!stored || stored !== orcidState) {
        console.error('ORCID OAuth state mismatch — signing out');
        import('./lib/supabase').then(({ supabase }) => supabase.auth.signOut());
      }
    }
    const userParam = params.get('user');
    // OpenAlex fallback profile (?user=openalex:A...) — must be checked before the
    // generic Scholar handler, which would otherwise wrap it in a scholar.google URL.
    if (userParam && userParam.startsWith(OPENALEX_ID_PREFIX) && handleSearchRef.current) {
      handleSearchRef.current(userParam, true);
      return;
    }
    if (userParam && userParam.length >= 12 && handleSearchRef.current) {
      const scholarUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userParam)}`;
      handleSearchRef.current(scholarUrl, true);
      return;
    }

    // Real profile path (/scholar/<id>), the canonical shareable form.
    // Checked before the vanity-slug lookup; a slug can never contain "/".
    const scholarPathMatch = window.location.pathname.match(/^\/scholar\/([^/]+)\/?$/);
    if (scholarPathMatch && handleSearchRef.current) {
      let pathId: string;
      try {
        pathId = decodeURIComponent(scholarPathMatch[1]);
      } catch {
        return; // malformed percent-encoding in a mangled link — treat as not found
      }
      if (pathId.startsWith(OPENALEX_ID_PREFIX)) {
        handleSearchRef.current(pathId, true);
      } else {
        const scholarUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(pathId)}`;
        handleSearchRef.current(scholarUrl, true);
      }
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
        })
        .catch((err: unknown) => logCaughtError(err, 'navigation', 'App', 'load-vanity-slug', { pathSlug }));
    }
  }, [initialUrlHandled]);

  // Keep the page in sync with browser back/forward for the content-page routes.
  useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname.replace(/^\//, '').replace(/\/$/, '').toLowerCase();
      const PAGE_ROUTES: Page[] = ['about', 'terms', 'privacy', 'changelog', 'trending'];
      setPage((PAGE_ROUTES as string[]).includes(p) ? (p as Page) : 'home');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
  const ANON_FREE_LIMIT = 2;

  /** Re-key S2 enrichment results to PublicationsList normalization and update state */
  const applyS2Data = (s2Result: Awaited<ReturnType<typeof enrichWithSemanticScholar>>, pubs: Array<{ title: string }>) => {
    const s2Data: Record<string, { influentialCitationCount: number; tldr?: string; s2CitationCount?: number }> = {};
    for (const pub of pubs) {
      const pubKey = pub.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const s2Normalized = pub.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      const paper = s2Result.papers.get(s2Normalized);
      if (paper) {
        s2Data[pubKey] = {
          influentialCitationCount: paper.influentialCitationCount,
          tldr: paper.tldr?.text,
          s2CitationCount: paper.citationCount,
        };
      }
    }
    setData(prev => prev ? { ...prev, s2Data, s2Stats: s2Result.stats } : prev);
  };

  const handleSearch = useCallback(async (url: string, bypassCredits = false, cacheOnly = false) => {
    // Prevent multiple concurrent requests using ref to avoid stale closure
    if (requestInProgressRef.current) {
      return;
    }

    // OpenAlex fallback profile (sourced from open data when Scholar is unavailable).
    // Free to view — it never hits SerpAPI/credits — so skip the usage gates entirely.
    const isOpenAlex = url.startsWith(OPENALEX_ID_PREFIX);

    // Credit/usage checks (skip for direct profile links, vanity URLs, OpenAlex fallbacks)
    if (!bypassCredits && !isOpenAlex) {
      if (!user) {
        // Anonymous user — check local free limit
        if (getAnonSearches() >= ANON_FREE_LIMIT) {
          trackEvent('signup_wall_shown', { searches_used: getAnonSearches() });
          setShowSignUpWall(true);
          return;
        }
      } else if (credits !== null && credits <= 0) {
        trackEvent('credit_wall_shown', { user_id: user.id });
        setShowCreditPacks(true);
        return;
      }
    }

    try {
      requestInProgressRef.current = true;
      setLoading(true);
      setError(null);
      setData(null);

      let profileData: Awaited<ReturnType<typeof scholarService.fetchProfile>>;
      let userId: string | null;
      if (isOpenAlex) {
        userId = url; // keep the "openalex:<id>" token for sharing + analytics
        profileData = await fetchOpenAlexProfile(url);
      } else {
        const validated = scholarService.validateProfileUrl(url);
        if (!validated.isValid) {
          setError('Invalid Google Scholar URL format. Please enter a valid profile URL.');
          setShowError(true);
          return;
        }
        userId = validated.userId;
        profileData = await scholarService.fetchProfile(url, cacheOnly ? { cacheOnly: true } : undefined);
      }
      if (!profileData) {
        setError('Unable to fetch profile data. Please try again later or contact the site administrator.');
        setShowError(true);
        return;
      }

      // Preserve the source-derived identity for the OpenAlex metric lookups
      // below. A display correction (name/affiliation) must not change which
      // OpenAlex author the field-normalized metrics are computed against —
      // corrections are display-only, metrics stay purely source-derived.
      const sourceName = profileData.name;
      const sourceAffiliation = profileData.affiliation;

      // Apply any verified corrections (wrong affiliation, stale title, etc.) on
      // top of the source-derived profile. No-op for profiles without overrides.
      try {
        const overrides = await fetchProfileOverrides(userId ?? url);
        if (overrides.length > 0) {
          profileData = applyProfileOverrides(profileData, overrides);
        }
      } catch {
        // Corrections are best-effort — never block a profile from rendering.
      }

      // Track usage (skip for direct profile links and OpenAlex fallbacks)
      if (!bypassCredits && !isOpenAlex) {
        if (!user) {
          // Cache hits count too — the free limit meters value delivered to the
          // visitor, not upstream fetch cost.
          incrementAnonSearches();
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
      // Mark field-normalized metrics as loading so the metrics tab can show a
      // skeleton for that section while the (async) OpenAlex fetch runs.
      setData({ ...sanitizedData, fieldMetricsLoading: true });
      trackEvent('search', { author_id: userId, cache: profileData.cacheStatus, bypass: bypassCredits });

      // Fetch Open Access stats from OpenAlex (non-blocking). Pass the real
      // publication titles so OA stats exclude works misattributed to a
      // same-named author by OpenAlex disambiguation.
      openAlexService.fetchOpenAccessStats(sourceName, sourceAffiliation, sanitizedData.publications.map(p => p.title))
        .then(oaStats => {
          if (oaStats) {
            setData(prev => prev ? { ...prev, openAccess: oaStats } : prev);

            // Enrich with Semantic Scholar data using DOIs from OpenAlex
            // Re-key doiMap from OA normalization (alphanumeric) to S2 normalization (keeps spaces)
            let doiMap: Map<string, string> | undefined;
            if (oaStats.doiMap) {
              doiMap = new Map<string, string>();
              for (const pub of sanitizedData.publications) {
                const oaKey = pub.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                const s2Key = pub.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
                const doi = oaStats.doiMap[oaKey];
                if (doi) doiMap.set(s2Key, doi);
              }
            }
            enrichWithSemanticScholar(sanitizedData.publications, doiMap)
              .then(s2Result => {
                applyS2Data(s2Result, sanitizedData.publications);
              })
              .catch((err) => {
                logCaughtError(err, 's2', 'App', 'enrich-with-dois', { pubCount: sanitizedData.publications.length });
              });
          } else {
            setData(prev => prev ? { ...prev, openAccessFailed: true } : prev);
            // Not an error — many authors simply aren't well-represented in OpenAlex.
            // The profile still renders; track it as a signal, not a failure.
            trackEvent('oa_stats_missing', { author: sanitizedData.name });
            // Still try S2 without DOI map (title search only, capped at 10)
            enrichWithSemanticScholar(sanitizedData.publications)
              .then(s2Result => {
                applyS2Data(s2Result, sanitizedData.publications);
              })
              .catch((err) => {
                logCaughtError(err, 's2', 'App', 'enrich-no-dois', { pubCount: sanitizedData.publications.length });
              });
          }
        })
        .catch((err) => {
          setData(prev => prev ? { ...prev, openAccessFailed: true } : prev);
          logCaughtError(err, 'openalex', 'App', 'fetch-oa-stats', { name: sanitizedData.name });
        });

      // Fetch field-normalized metrics from OpenAlex + iCite (non-blocking)
      fetchFieldNormalizedMetrics(sourceName, sourceAffiliation)
        .then(fieldMetrics => {
          if (fieldMetrics) {
            setData(prev => prev ? { ...prev, fieldMetrics } : prev);
          }
        })
        .catch((err) => logCaughtError(err, 'openalex', 'App', 'fetch-field-metrics', { name: sanitizedData.name }))
        .finally(() => setData(prev => prev ? { ...prev, fieldMetricsLoading: false } : prev));

      // Update browser URL with shareable link (preserve vanity URL if loaded via slug)
      const pathSlug = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
      const isVanityUrl = pathSlug && /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(pathSlug);
      if (!isVanityUrl && userId) {
        window.history.replaceState({}, '', `/scholar/${encodeURIComponent(userId)}`);
      }
    } catch (err) {
      let errorMessage: string;

      if (err instanceof ApiError) {
        errorMessage = err.message;
        if (err.code !== 'CREDITS_EXHAUSTED') {
          logCaughtError(err, 'profile', 'App', 'fetch-profile', { url, code: err.code });
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
        logCaughtError(err, 'profile', 'App', 'fetch-profile', { url });
      } else {
        errorMessage = 'An unexpected error occurred';
        logError({ category: 'profile', message: errorMessage, component: 'App', action: 'fetch-profile', context: { url } });
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
    window.history.replaceState({}, '', '/');
  }, []);

  const handleNavigate = useCallback((newPage: Page) => {
    setPage(newPage);
    window.scrollTo(0, 0);
    // Reflect the page in the URL so content pages are shareable + deep-linkable.
    const PATH_PAGES: Page[] = ['about', 'terms', 'privacy', 'changelog', 'trending'];
    const path = newPage === 'home' ? '/' : (PATH_PAGES.includes(newPage) ? `/${newPage}` : window.location.pathname);
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
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
    if (page === 'admin') {
      if (!isAdmin) { handleNavigate('home'); return null; }
      return <div className="page-enter"><AdminDashboard onBack={() => handleNavigate('home')} /></div>;
    }
    if (page === 'trending') return <div className="page-enter"><TrendingPage onBack={() => handleNavigate('home')} /></div>;
    if (page === 'about') return <div className="page-enter"><AboutPage onBack={() => handleNavigate('home')} socialLinks={<SocialLinks />} authControls={authControls} /></div>;
    if (page === 'terms') return <div className="page-enter"><TermsPage onBack={() => handleNavigate('home')} /></div>;
    if (page === 'privacy') return <div className="page-enter"><PrivacyPage onBack={() => handleNavigate('home')} /></div>;
    if (page === 'changelog') return <div className="page-enter"><ChangelogPage onBack={() => handleNavigate('home')} /></div>;

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
      {/* Welcome banner for new sign-ups */}
      {showWelcome && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#eaf4f4] border border-[#2d7d7d]/20 text-[#1e293b] px-5 py-3 rounded-xl shadow-lg max-w-sm text-center animate-fade-up">
          <p className="text-sm font-medium mb-1">Welcome to Scholar Folio!</p>
          <p className="text-xs text-gray-600">You have <strong>10 free profile refreshes</strong> to get started.</p>
          <button
            onClick={dismissWelcome}
            className="mt-2 text-xs text-[#2d7d7d] hover:underline font-medium"
          >
            Got it
          </button>
        </div>
      )}
      {/* One-time thank-you bonus popup for existing users */}
      {user && !showWelcome && showBonus && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#eaf4f4] border border-[#2d7d7d]/20 text-[#1e293b] px-5 py-3 rounded-xl shadow-lg max-w-sm text-center animate-fade-up">
          <p className="text-sm font-medium mb-1">Thank you for being a Scholar Folio user!</p>
          <p className="text-xs text-gray-600">We've added <strong>10 bonus credits</strong> to your account as a thank you for signing up.</p>
          <button
            onClick={() => { localStorage.setItem('sf_bonus_seen', '1'); setShowBonus(false); refreshCredits(); }}
            className="mt-2 text-xs text-[#2d7d7d] hover:underline font-medium"
          >
            Awesome, thanks!
          </button>
        </div>
      )}
      {showPasswordReset && <PasswordResetModal onSubmit={updatePassword} onClose={dismissPasswordReset} />}
      <div className="flex-1">
        {renderPage()}
      </div>
      <Footer onNavigate={handleNavigate} onSupport={() => setShowCreditPacks(true)} />
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
