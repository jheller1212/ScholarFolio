import React, { useState, useCallback, useRef } from 'react';
import { GraduationCap, Linkedin, Github, AlertCircle } from 'lucide-react';
import { SearchBar } from './components/SearchBar';
import { LandingPage } from './components/LandingPage';
import { ApiError } from './utils/api';
import { ErrorModal } from './components/ErrorModal';
import { ProfileView } from './components/ProfileView';
import { PrivacyModal } from './components/PrivacyModal';
import { TermsModal } from './components/TermsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Author } from './types/scholar';
import { scholarService } from './services/scholar';

const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/in/hellerjonas/',
  github: 'https://github.com/JonasHeller1212'
};

function SocialLinks() {
  return (
    <div className="flex items-center space-x-4">
      <a
        href={SOCIAL_LINKS.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-600 hover:text-blue-600 transition-colors"
        title="LinkedIn Profile"
      >
        <Linkedin className="h-5 w-5" />
      </a>
      <a
        href={SOCIAL_LINKS.github}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-600 hover:text-gray-900 transition-colors"
        title="GitHub Profile"
      >
        <Github className="h-5 w-5" />
      </a>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Author | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showError, setShowError] = useState(false);
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
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col">
        {data && !error ? (
          <ProfileView
            data={data}
            loading={loading}
            error={error}
            onSearch={handleSearch}
            onReset={handleReset}
            socialLinks={<SocialLinks />}
          />
        ) : (
          <LandingPage onSearch={handleSearch} loading={loading} error={error} />
        )}
        {showError && error && (
          <ErrorModal message={error} onClose={handleReset} />
        )}
        <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
        <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
