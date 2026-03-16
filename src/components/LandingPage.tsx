import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Search, Network, BarChart, BookOpen, ArrowRight, Menu, X, ExternalLink, User } from 'lucide-react';
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
            Know your
            <br />
            <span className="gradient-text">research story</span>
          </h1>

          <p className="animate-fade-up animate-delay-250 text-base md:text-lg text-[#64748b] max-w-xl mx-auto mb-8 leading-relaxed">
            Paste your Google Scholar profile URL to see your publication history, collaboration network, and research reach — on one page.
          </p>

          {/* Search area */}
          <div className="animate-fade-up-scale animate-delay-350 w-full max-w-xl mx-auto mb-2">
            <SearchBar onSearch={onSearch} isLoading={loading} error={error} />
          </div>

          {!user && (
            <p className="animate-fade-up animate-delay-350 text-xs text-[#64748b] mb-3">
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                Try it free — sign up for <strong>5 extra searches</strong>.
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
              Everything you need to understand your research
            </h2>
            <p className="text-sm text-[#64748b] max-w-lg mx-auto">
              A clear, honest picture of your research — built from your Google Scholar profile.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart,
                title: "Research Reach",
                description: "How far your work has travelled — citations, growth trends, and the conversations your research has opened."
              },
              {
                icon: Network,
                title: "Collaboration Network",
                description: "Co-authorship visualization, collaboration patterns, and research network mapping."
              },
              {
                icon: BookOpen,
                title: "Publication History",
                description: "Where you have published, how your output has evolved, and which venues your work calls home."
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="scroll-reveal group relative bg-white rounded-2xl p-6 border border-gray-100 border-l-[3px] border-l-[#2d7d7d] shadow-card hover-lift"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#eaf4f4] mb-3">
                  <feature.icon className="h-5 w-5 text-[#2d7d7d]" />
                </div>
                <h3 className="text-base font-semibold text-[#1e293b] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#64748b] leading-relaxed">{feature.description}</p>
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
              Ready to explore?
            </h2>
            <p className="text-sm text-white/60 mb-3 font-serif italic">
              Explore your research portfolio
            </p>
            <p className="text-sm text-white/50 mb-6 max-w-md mx-auto">
              Enter your Google Scholar profile URL below for an overview of your research portfolio.
            </p>

            <div className="max-w-xl mx-auto mb-3">
              <SearchBar onSearch={onSearch} isLoading={loading} />
            </div>

            <p className="text-xs text-white/40 italic mb-5">
              Numbers here are context, not verdict. Use them to tell your story.
            </p>

            <div className="flex flex-wrap justify-center gap-6">
              {['Instant Overview', 'Visual Insights', 'No Sign-up Required'].map((label) => (
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
