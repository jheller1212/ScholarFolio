import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Search, Network, BarChart, BookOpen, ArrowRight, Menu, X, ExternalLink, User, Link, BadgeCheck, Globe, Gauge, TrendingUp, Unlock, Award } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { ScholarSearchModal } from './ScholarSearchModal';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';

interface LandingPageProps {
  onSearch: (url: string) => void;
  loading: boolean;
  error?: string | null;
  onNavigate?: (page: 'home' | 'about' | 'terms' | 'privacy') => void;
  authControls?: React.ReactNode;
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Stagger children
            const children = entry.target.querySelectorAll('.scroll-reveal');
            children.forEach((child, i) => {
              setTimeout(() => {
                child.classList.add('revealed');
              }, i * 80);
            });
            // Also reveal the container itself
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function LandingPage({ onSearch, loading, error, onNavigate, authControls }: LandingPageProps) {
  const [showScholarSearch, setShowScholarSearch] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const featuresRef = useScrollReveal();
  const ctaRef = useScrollReveal();
  const { user } = useAuth();

  return (
    <main className="flex-1 mesh-bg">
      {/* Navbar */}
      <nav className="border-b border-gray-200/60 bg-white/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm tracking-tight">Scholar Folio</span>
              <span className="text-[11px] text-[#94a3b8] hidden sm:inline">Your research, at a glance</span>
              <span className="text-[9px] text-transparent hidden sm:inline select-all" title="Build time">
                {new Date(__BUILD_TIME__).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-5">
            <a href="#features" className="nav-link text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">
              What it shows
            </a>
            <button onClick={() => onNavigate?.('about')} className="nav-link text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">
              About
            </button>
            <a
              href="https://github.com/JonasHeller1212/ResearchFolio"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors inline-flex items-center gap-1"
            >
              GitHub <ExternalLink className="h-3 w-3" />
            </a>
            {authControls && (
              <>
                <div className="h-4 w-px bg-gray-200" />
                {authControls}
              </>
            )}
          </div>
          <div className="sm:hidden flex items-center gap-2">
            {authControls}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-gray-600" /> : <Menu className="h-5 w-5 text-gray-600" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white/90 backdrop-blur-lg">
            <div className="px-6 py-4 space-y-3">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-gray-600 hover:text-gray-900">
                What it shows
              </a>
              <button onClick={() => { onNavigate?.('about'); setMobileMenuOpen(false); }} className="block text-sm text-gray-600 hover:text-gray-900">
                About
              </button>
              <a
                href="https://github.com/JonasHeller1212/ResearchFolio"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-600 hover:text-gray-900"
              >
                GitHub
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-16 pb-6 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="animate-fade-up animate-delay-150 font-serif text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#1e293b] mb-4 leading-[1.05]">
            Claim your
            <br />
            <span className="gradient-text">research profile</span>
          </h1>

          <p className="animate-fade-up animate-delay-250 text-base md:text-lg text-[#64748b] max-w-xl mx-auto mb-8 leading-relaxed">
            Get a shareable portfolio page for your research — your publications, citations, and collaboration network at a memorable URL like <span className="font-medium text-[#2d7d7d]">scholarfolio.org/your-name</span>.
          </p>

          {/* Search area */}
          <div className="animate-fade-up-scale animate-delay-350 w-full max-w-xl mx-auto mb-2">
            <SearchBar onSearch={onSearch} isLoading={loading} error={error} />
          </div>

          {!user && (
            <p className="animate-fade-up animate-delay-350 text-xs text-[#64748b] mb-3">
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                Sign up to <strong>claim your profile</strong> and get a permanent URL.
              </span>
            </p>
          )}

          <p className="animate-fade-up animate-delay-350 text-xs text-[#94a3b8] italic mb-4">
            Numbers here are context, not verdict. Use them to tell your story.
          </p>

          <button
            onClick={() => setShowScholarSearch(true)}
            className="animate-fade-up animate-delay-350 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#2d7d7d] transition-colors group"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Or search by author name</span>
            <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14 px-6" ref={featuresRef}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 scroll-reveal">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#1e293b] mb-3">
              Your research, one link away
            </h2>
            <p className="text-sm text-[#64748b] max-w-lg mx-auto">
              A clear, honest picture of your research — impact metrics, p-index, collaboration network, and more — built from your Google Scholar profile, shareable in one click.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Link,
                title: "Your Profile, Your URL",
                description: "Claim a vanity URL like scholarfolio.org/your-name. Add it to your CV, email signature, or LinkedIn.",
                color: '#2d7d7d',
                bg: '#eaf4f4',
              },
              {
                icon: BarChart,
                title: "Impact Metrics",
                description: "h-index, g-index, i10, citation growth, Gini coefficient, and age-normalized rates — all computed automatically.",
                color: '#b08d57',
                bg: '#faf6ef',
              },
              {
                icon: Gauge,
                title: "Field-Normalized Impact & P-Index",
                description: "FWCI, Mean Journal Impact, and the p-index — see how your papers perform relative to their field, venue, and publication year, with authorship weighting.",
                color: '#6b5b8a',
                bg: '#f3f0f8',
              },
              {
                icon: TrendingUp,
                title: "Citation Trends",
                description: "Year-by-year citation charts, cumulative growth, publication output, and momentum analysis.",
                color: '#4a6fa5',
                bg: '#eef3fa',
              },
              {
                icon: Globe,
                title: "Co-Author World Map",
                description: "See where your collaborators are — an interactive map of co-author institutions across the globe.",
                color: '#2d7d7d',
                bg: '#eaf4f4',
              },
              {
                icon: Unlock,
                title: "Open Access Profile",
                description: "Gold, green, hybrid, and bronze OA breakdown. See how accessible your research is to the world.",
                color: '#4a8c6f',
                bg: '#eef7f2',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="scroll-reveal group relative bg-white rounded-2xl p-5 border border-gray-100 shadow-card hover-lift"
                style={{ borderLeftWidth: '3px', borderLeftColor: feature.color }}
              >
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2.5" style={{ backgroundColor: feature.bg }}>
                  <feature.icon className="h-4 w-4" style={{ color: feature.color }} />
                </div>
                <h3 className="text-sm font-semibold text-[#1e293b] mb-1.5">{feature.title}</h3>
                <p className="text-xs text-[#64748b] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 px-6" ref={ctaRef}>
        <div className="max-w-3xl mx-auto scroll-reveal">
          <div className="bg-[#1e293b] rounded-2xl p-8 md:p-10 text-center">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-white mb-3">
              Claim your profile
            </h2>
            <p className="text-sm text-white/60 mb-3 font-serif italic">
              Your research deserves its own page
            </p>
            <p className="text-sm text-white/50 mb-6 max-w-md mx-auto">
              Search your Google Scholar profile to get started. Claim your vanity URL and share your research with the world.
            </p>

            <div className="max-w-xl mx-auto mb-3">
              <SearchBar onSearch={onSearch} isLoading={loading} />
            </div>

            <p className="text-xs text-white/40 italic mb-5">
              Numbers here are context, not verdict. Use them to tell your story.
            </p>

            <div className="flex flex-wrap justify-center gap-6">
              {['Permanent URL', 'Verified Badge', 'Share Anywhere'].map((label) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-white/60">
                  <CheckCircle className="h-3.5 w-3.5 text-white/40" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ScholarSearchModal
        isOpen={showScholarSearch}
        onClose={() => setShowScholarSearch(false)}
        onSelect={onSearch}
      />
    </main>
  );
}
