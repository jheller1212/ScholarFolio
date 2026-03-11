export const metricInfo = {
  citations: {
    description: "Total number of times all publications have been cited by other works",
    pros: "Provides a direct and widely recognized measure of overall research impact across all publications.",
    cons: "Can be skewed by self-citations, field-specific citation patterns, and publication age.",
    link: "https://en.wikipedia.org/wiki/Citation_impact"
  },
  avgCitationsPerPaper: {
    description: "Mean number of citations across all publications (total citations divided by number of papers)",
    pros: "Normalizes impact across different publication counts and career lengths, enabling fair comparison between researchers.",
    cons: "Can be heavily skewed by a few highly-cited papers and doesn't show citation distribution.",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Citations_per_paper"
  },
  citationGrowth: {
    description: "Average year-over-year percentage change in citations over the last three complete years, calculated using a weighted average that emphasizes recent growth.\n\nExample calculation:\nYear 1 (2021): 100 citations\nYear 2 (2022): 120 citations (+20%)\nYear 3 (2023): 150 citations (+25%)\nGrowth Rate = (20% + 25% + 25%) / 3 = +23.3%\n\nNegative example:\nYear 1 (2021): 200 citations\nYear 2 (2022): 180 citations (-10%)\nYear 3 (2023): 170 citations (-5.6%)\nGrowth Rate = (-10% + -5.6% + -5.6%) / 3 = -7.1%",
    pros: "• Focuses on recent impact trajectory\n• Uses multiple years to smooth out annual fluctuations\n• Excludes current incomplete year for accuracy\n• Provides clear growth trajectory indicator\n• Helps identify rising research influence",
    cons: "• May not reflect very recent publications\n• Sensitive to field citation patterns\n• Three-year window might miss longer patterns\n• Growth rates can be volatile for small citation counts",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Citation_velocity"
  },
  peak: {
    description: "Highest annual citation count achieved throughout the researcher's career",
    pros: "Identifies periods of maximum influence and breakthrough research impact, helps track career milestones and research peaks.",
    cons: "Single-year metric that may reflect temporary spikes rather than sustained impact, can be influenced by individual highly-cited papers.",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Citation_patterns"
  },
  trend: {
    description: "Citation trend analysis based on the last three complete years of data, calculated using a sophisticated algorithm that considers both absolute changes and relative growth rates.",
    pros: "Provides nuanced insight into recent research momentum and helps identify emerging research leaders.",
    cons: "May not reflect very recent publications still accumulating citations and field-specific patterns.",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Citation_trends"
  },
  citationsPerYear: {
    description: "Average number of citations received per year, calculated by dividing the total number of citations by the number of years since the first publication.\n\nExample calculation:\nTotal citations: 1000\nFirst publication year: 2018\nCurrent year: 2024\nYears active: 6\nCitations per year = 1000 / 6 = 166.7",
    pros: "• Normalizes citation impact across different career lengths\n• Accounts for total research span\n• Useful for comparing researchers at different career stages\n• Shows sustained impact over time",
    cons: "• Can be skewed by highly-cited early papers\n• Doesn't show citation distribution over time\n• May underrepresent recent productivity changes\n• Assumes linear citation accumulation",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Time-normalized_metrics"
  },
  acc5: {
    description: "Accumulated Citation Count for the last 5 years (ACC5), showing recent research impact",
    pros: "Captures recent research relevance and current impact in the field more accurately than lifetime metrics.",
    cons: "May undervalue seminal older works and disadvantage researchers with longer career histories.",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Time_windows"
  },
  network: {
    description: "Total number of unique co-authors across all publications",
    pros: "Demonstrates breadth of research network and collaborative reach within the field.",
    cons: "May include one-time collaborations and doesn't indicate collaboration frequency or depth.",
    link: "https://en.wikipedia.org/wiki/Scientific_collaboration#Network_analysis"
  },
  collaborationScore: {
    description: "Percentage of publications with multiple authors",
    pros: "Effectively measures research team integration and collaborative research tendency.",
    cons: "Doesn't reflect individual contribution levels or the quality of collaborations.",
    link: "https://en.wikipedia.org/wiki/Scientific_collaboration"
  },
  coAuthors: {
    description: "Total number of unique researchers who have co-authored publications",
    pros: "Shows the size and diversity of research collaborations and academic network.",
    cons: "Doesn't distinguish between frequent collaborators and one-time co-authors.",
    link: "https://en.wikipedia.org/wiki/Co-author"
  },
  topCoAuthor: {
    description: "Most frequent co-author based on number of shared publications",
    pros: "Identifies strongest research collaborations and key research partnerships.",
    cons: "Doesn't reflect the impact or quality of the collaborative work.",
    link: "https://en.wikipedia.org/wiki/Scientific_collaboration#Collaboration_patterns"
  },
  soloAuthor: {
    description: "Percentage of publications where the researcher is the sole author",
    pros: "Clearly demonstrates independent research capability and individual scholarly contributions.",
    cons: "May suggest limited collaboration in fields where team science is increasingly important.",
    link: "https://en.wikipedia.org/wiki/Scientific_collaboration#Solo_research"
  },
  averageAuthors: {
    description: "Mean number of authors per publication across all works",
    pros: "Provides insight into typical research team size and collaboration intensity patterns.",
    cons: "Doesn't reflect contribution levels or account for field-specific authorship conventions.",
    link: "https://en.wikipedia.org/wiki/Scientific_collaboration#Team_size"
  },
  hIndex: {
    description: "Number h of papers with at least h citations each",
    pros: "Balances productivity and impact while being robust to outliers and low-cited papers.",
    cons: "Disadvantages early career researchers and varies significantly across different fields.",
    link: "https://en.wikipedia.org/wiki/H-index"
  },
  gIndex: {
    description: "Largest number g where g most cited papers have at least g² citations in total",
    pros: "Better captures the impact of highly-cited papers while maintaining citation balance.",
    cons: "More complex to calculate and interpret than other citation metrics.",
    link: "https://en.wikipedia.org/wiki/G-index"
  },
  i10Index: {
    description: "Number of publications with at least 10 citations",
    pros: "Provides a simple and easily understood measure of consistent research impact.",
    cons: "Uses an arbitrary threshold and doesn't account for field-specific citation patterns.",
    link: "https://scholar.google.com/intl/en/scholar/metrics.html#metrics"
  },
  h5Index: {
    description: "h-index calculated using only publications from the last 5 years",
    pros: "Effectively captures recent research impact and current field influence.",
    cons: "May undervalue important older works and fluctuate more than career-spanning metrics.",
    link: "https://scholar.google.com/intl/en/scholar/metrics.html#metrics"
  },
  halfLife: {
    description: "Number of years back from the present needed to account for 50% of total citations. Calculated by summing citations from the most recent year backwards until the cumulative total reaches half of all citations.",
    pros: "Reveals whether a researcher's impact is recent and growing or driven by classic older works. A short half-life signals current relevance.",
    cons: "Can be misleading for researchers with very few total citations or a single breakout paper.",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Citation_half-life"
  },
  gini: {
    description: "Measures how evenly citations are distributed across all publications, on a 0–1 scale. 0 means every paper has equal citations; 1 means all citations come from a single paper.\n\nExample:\n• Gini ≈ 0.3 — citations are spread fairly evenly\n• Gini ≈ 0.7 — citations are concentrated in a few papers\n• Gini ≈ 0.9 — almost all citations come from one or two works",
    pros: "Complements h-index by revealing whether impact is broad or concentrated in a few 'hit' papers. Useful for understanding research portfolio balance.",
    cons: "Sensitive to publication count — researchers with few papers will naturally show higher concentration.",
    link: "https://en.wikipedia.org/wiki/Gini_coefficient"
  },
  ageNormalized: {
    description: "Total citations divided by career length in years (from first publication year to the current year). Normalizes raw citation count by how long a researcher has been active.\n\nExample: 5,000 citations over a 20-year career = 250 citations/career year.",
    pros: "Enables fairer comparison between early-career and established researchers by accounting for career length. Shows sustained impact rate.",
    cons: "Career start year is approximated from the earliest citation year, which may not match actual career start. Doesn't account for career breaks.",
    link: "https://en.wikipedia.org/wiki/Citation_impact#Time-normalized_metrics"
  },
  pubsPerYear: {
    description: "Average number of publications per year",
    pros: "Shows research productivity consistency and output level throughout career.",
    cons: "Doesn't reflect publication quality or account for varying career stage demands.",
    link: "https://en.wikipedia.org/wiki/Academic_publishing"
  }
};