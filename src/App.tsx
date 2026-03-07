import React, { useState, useCallback, useRef } from 'react';
import { Linkedin, Github, ExternalLink } from 'lucide-react';
import { LandingPage } from './components/LandingPage';
import { ApiError } from './utils/api';
import { ErrorModal } from './components/ErrorModal';
import { ProfileView } from './components/ProfileView';
import { AboutPage } from './components/AboutPage';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Author } from './types/scholar';
import { scholarService } from './services/scholar';

const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/in/hellerjonas/',
  github: 'https://github.com/JonasHeller1212/ResearchFolio'
};

type Page = 'home' | 'about' | 'terms' | 'privacy';

function SocialLinks() {
  return (
    <div className="flex items-center gap-3">
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
        className="text-gray-400 hover:text-gray-900 transition-colors"
        title="GitHub"
      >
        <Github className="h-4 w-4" />
      </a>
    </div>
  );
}

function Footer({ onNavigate }: { onNavigate: (page: Page) => void }) {
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

function App() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Author | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const requestInProgressRef = useRef(false);

  const handleSearch = useCallback(async (url: string) => {
    // Prevent multiple concurrent requests using ref to avoid stale closure
    if (requestInProgressRef.current) {
      return;
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

      const profileData = await scholarService.fetchProfile(url);
      if (!profileData) {
        setError('Failed to fetch profile data. Please try again.');
        setShowError(true);
        return;
      }

      // Ensure metrics exists with default values even if undefined
      const sanitizedData = {
        ...profileData,
        metrics: profileData.metrics ?? { citationsPerYear: {} }
      };

      setData(sanitizedData);
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
  }, []);

  const handleReset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    requestInProgressRef.current = false;
    setShowError(false);
    setPage('home');
  }, []);

  const handleNavigate = useCallback((newPage: Page) => {
    setPage(newPage);
    window.scrollTo(0, 0);
  }, []);

  const renderPage = () => {
    if (page === 'about') return <AboutPage onBack={() => handleNavigate('home')} />;
    if (page === 'terms') return <TermsPage onBack={() => handleNavigate('home')} />;
    if (page === 'privacy') return <PrivacyPage onBack={() => handleNavigate('home')} />;

    if (data && !error) {
      return (
        <ProfileView
          data={data}
          loading={loading}
          error={error}
          onSearch={handleSearch}
          onReset={handleReset}
          socialLinks={<SocialLinks />}
        />
      );
    }

    return <LandingPage onSearch={handleSearch} loading={loading} error={error} onNavigate={handleNavigate} />;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          {renderPage()}
        </div>
        {!(data && !error) && <Footer onNavigate={handleNavigate} />}
        {showError && error && (
          <ErrorModal message={error} onClose={handleReset} />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
