import React, { useState } from 'react';
import { CheckCircle, Search, Network, BarChart, BookOpen, ArrowRight } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { ScholarSearchModal } from './ScholarSearchModal';
import { Logo } from './Logo';

interface LandingPageProps {
  onSearch: (url: string) => void;
  loading: boolean;
  error?: string | null;
}

export function LandingPage({ onSearch, loading, error }: LandingPageProps) {
  const [showScholarSearch, setShowScholarSearch] = useState(false);

  return (
    <main className="flex-1 mesh-bg">
      {/* Navbar */}
      <nav className="border-b border-gray-200/60 bg-white/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm tracking-tight">Research Portfolio</span>
              <span className="text-[11px] text-gray-400 hidden sm:inline">Your research, at a glance</span>
            </div>
          </div>
          <a
            href="#features"
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            What it shows
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#1e293b] mb-6 leading-[1.05]">
            Know your
            <br />
            <span className="gradient-text">research story</span>
          </h1>

          <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto mb-12 leading-relaxed">
            Paste your Google Scholar profile URL to see your publication history, collaboration network, and research reach on one page.
          </p>

          {/* Search area */}
          <div className="w-full max-w-xl mx-auto mb-3">
            <SearchBar onSearch={onSearch} isLoading={loading} error={error} />
          </div>

          <p className="text-xs text-gray-400 italic mb-6">
            Numbers here are context, not verdict. Use them to tell your story.
          </p>

          <button
            onClick={() => setShowScholarSearch(true)}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-start transition-colors group"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Or search by author name</span>
            <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Everything you need to understand your research
            </h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              A clear, honest picture of your research, built from your Google Scholar profile.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart,
                title: "Research Reach",
                description: "How far your work has travelled. Citations, growth trends, and the conversations your research has opened."
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
                className="group relative bg-white rounded-2xl p-7 border border-gray-100 border-l-[3px] border-l-primary-start shadow-card hover:shadow-card-hover transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-5">
                  <feature.icon className="h-5 w-5 text-primary-start" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#1e293b] rounded-2xl p-8 md:p-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 mb-6">
              <span className="text-xs font-medium text-white/80">Ready to explore?</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Explore your research portfolio
            </h2>
            <p className="text-sm text-white/60 mb-8 max-w-md mx-auto">
              Enter your Google Scholar profile URL below for an overview of your research portfolio.
            </p>

            <div className="max-w-xl mx-auto mb-6">
              <SearchBar onSearch={onSearch} isLoading={loading} />
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {['Instant Overview', 'Visual Insights', 'Free to Use'].map((label) => (
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
      />
    </main>
  );
}
