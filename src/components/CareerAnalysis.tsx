import React from 'react';
import { TrendingUp, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface MetricAnalysis {
  earlyCareer: {
    typical: string;
    interpretation: string;
  };
  established: {
    typical: string;
    interpretation: string;
  };
  significance: string;
  limitations: string[];
  recommendations: string[];
}

const metricsAnalysis: Record<string, MetricAnalysis> = {
  citations: {
    earlyCareer: {
      typical: "50-500",
      interpretation: "Building citation base, highly field-dependent"
    },
    established: {
      typical: "1,000+",
      interpretation: "Substantial citation accumulation, field leader status"
    },
    significance: "Indicates overall research impact and visibility",
    limitations: [
      "Field-dependent citation rates",
      "Self-citation effects",
      "Time lag in citation accumulation"
    ],
    recommendations: [
      "Consider relative to field averages",
      "Focus on citation trajectory rather than absolute numbers",
      "Use alongside other impact metrics"
    ]
  },
  hIndex: {
    earlyCareer: {
      typical: "3-8",
      interpretation: "Developing consistent impact"
    },
    established: {
      typical: "12-25+",
      interpretation: "Sustained high-impact contributions"
    },
    significance: "Balances productivity with impact",
    limitations: [
      "Cannot decrease over time",
      "Favors older publications",
      "Field-dependent benchmarks"
    ],
    recommendations: [
      "Use m-quotient for career stage comparison",
      "Consider field-specific h-index benchmarks",
      "Track rate of increase"
    ]
  },
  i10Index: {
    earlyCareer: {
      typical: "2-10",
      interpretation: "Building portfolio of cited works"
    },
    established: {
      typical: "20-50+",
      interpretation: "Broad impact across multiple works"
    },
    significance: "Shows breadth of impactful research",
    limitations: [
      "Arbitrary threshold",
      "Doesn't reflect citation magnitude",
      "Field-dependent"
    ],
    recommendations: [
      "Useful for quick comparisons",
      "Consider alongside h-index",
      "Track growth rate"
    ]
  },
  citationsPerYear: {
    earlyCareer: {
      typical: "10-50",
      interpretation: "Growing recognition in field"
    },
    established: {
      typical: "100-500+",
      interpretation: "Sustained high visibility"
    },
    significance: "Indicates current research impact",
    limitations: [
      "Annual fluctuations",
      "Conference vs journal citation patterns",
      "Field size effects"
    ],
    recommendations: [
      "Focus on trend rather than absolute numbers",
      "Compare within similar career stages",
      "Consider field-specific patterns"
    ]
  },
  publicationsPerYear: {
    earlyCareer: {
      typical: "2-5",
      interpretation: "Establishing research pipeline"
    },
    established: {
      typical: "4-8+",
      interpretation: "Sustained productivity"
    },
    significance: "Shows research productivity rate",
    limitations: [
      "Quality vs quantity",
      "Publication type variations",
      "Collaboration effects"
    ],
    recommendations: [
      "Balance with impact metrics",
      "Consider publication quality/venue",
      "Account for author position"
    ]
  }
};

export function CareerAnalysis() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <TrendingUp className="h-5 w-5 text-[#2d7d7d] mr-2" />
          Career Stage Metrics Analysis
        </h2>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Early-career: 0-5 years post-PhD</span>
          <span>|</span>
          <span>Established: 5+ years</span>
        </div>
      </div>

      <div className="grid gap-6">
        {Object.entries(metricsAnalysis).map(([metric, analysis]) => (
          <div key={metric} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-900 capitalize">
                {metric.replace(/([A-Z])/g, ' $1').trim()}
              </h3>
            </div>
            
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Career Stage Comparison */}
                <div className="space-y-4">
                  <h4 className="text-xs font-medium text-gray-500">Career Stage Comparison</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-[#2d7d7d]">Early-Career</div>
                      <div className="text-2xl font-bold text-gray-900">{analysis.earlyCareer.typical}</div>
                      <div className="text-xs text-gray-600">{analysis.earlyCareer.interpretation}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-[#334155]">Established</div>
                      <div className="text-2xl font-bold text-gray-900">{analysis.established.typical}</div>
                      <div className="text-xs text-gray-600">{analysis.established.interpretation}</div>
                    </div>
                  </div>
                </div>

                {/* Analysis */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2">Significance</h4>
                    <p className="text-sm text-gray-600">{analysis.significance}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mr-1" />
                      Limitations
                    </h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {analysis.limitations.map((limitation, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-amber-500 mr-1">•</span>
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                      <CheckCircle className="h-3.5 w-3.5 text-[#2d7d7d] mr-1" />
                      Recommendations
                    </h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {analysis.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-[#2d7d7d] mr-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#eaf4f4] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#1e293b] mb-4">Key Takeaways</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-medium text-[#334155] mb-2">Early-Career Researchers</h4>
            <ul className="text-xs text-[#64748b] space-y-2">
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Focus on publication quality over quantity
              </li>
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Use time-normalized metrics (m-quotient)
              </li>
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Track citation growth rate and trajectory
              </li>
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Consider field-specific benchmarks
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-[#334155] mb-2">Established Researchers</h4>
            <ul className="text-xs text-[#64748b] space-y-2">
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Balance comprehensive metrics (h-index, total citations)
              </li>
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Monitor sustained impact through citation patterns
              </li>
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Consider leadership and mentorship indicators
              </li>
              <li className="flex items-start">
                <span className="text-[#2d7d7d] mr-1">•</span>
                Evaluate research program breadth and depth
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}