import React, { useState } from 'react';
import { CheckCircle, Search, TrendingUp, Network, BarChart, BookOpen, ArrowRight, Sparkles, Zap } from 'lucide-react';
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
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <main className="flex-1 mesh-bg">
      {/* Navbar */}
      <nav className="border-b border-gray-100/80 bg-white/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <span className="font-semibold text-gray-900 text-sm tracking-tight">Scholar Metrics</span>
          </div>
          <a
            href="#features"
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Features
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary-start/10 to-primary-end/10 border border-primary-start/10 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-primary-end" />
            <span className="text-xs font-medium text-gray-700">Instant academic analytics</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.1]">
            Understand your
            <br />
            <span className="gradient-text">research impact</span>
          </h1>

          <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Paste your Google Scholar profile URL to get instant citation analytics, collaboration insights, and publication metrics.
          </p>

          {/* Search area */}
          <div className="w-full max-w-xl mx-auto mb-4">
            <SearchBar onSearch={onSearch} isLoading={loading} error={error} />
          </div>

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
      <section id="features" className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Everything you need to analyze your profile
            </h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Comprehensive metrics and visualizations derived from your Google Scholar data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: BarChart,
                title: "Citation Analytics",
                description: "h-index, g-index, i10-index, citation growth trends, and impact trajectory analysis.",
                color: "from-blue-500 to-cyan-500"
              },
              {
                icon: Network,
                title: "Network Analysis",
                description: "Co-authorship visualization, collaboration patterns, and research network mapping.",
                color: "from-primary-start to-primary-end"
              },
              {
                icon: BookOpen,
                title: "Publication Insights",
                description: "Journal rankings, publication timelines, citation distribution, and venue analysis.",
                color: "from-violet-500 to-purple-500"
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-card hover:shadow-card-hover transition-all duration-300"
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br ${feature.color} rounded-xl mb-4 shadow-sm`}>
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-8 md:p-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-end/5 mb-6">
              <Zap className="h-3.5 w-3.5 text-primary-end" />
              <span className="text-xs font-medium text-gray-600">Ready to get started?</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              Analyze your <span className="gradient-text">research impact</span>
            </h2>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              Enter your Google Scholar profile URL below to get instant insights into your academic influence.
            </p>

            <div className="max-w-xl mx-auto mb-6">
              <SearchBar onSearch={onSearch} isLoading={loading} />
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {['Instant Analysis', 'Visual Insights', 'Free to Use'].map((label) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <CheckCircle className="h-3.5 w-3.5 text-primary-start" />
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
