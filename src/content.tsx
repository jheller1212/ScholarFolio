import { createRoot } from 'react-dom/client';
import './index.css';

async function scrapePublicationDetails(url: string) {
  const response = await fetch(url);
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  
  return {
    citations: Array.from(doc.querySelectorAll('.gsc_a_tr')).map(citation => ({
      authors: citation.querySelector('.gsc_a_at')?.textContent || '',
      isSelfCitation: false, // Will be determined by comparing authors
    }))
  };
}

function scrapeProfileData() {
  const data = {
    name: document.querySelector('#gsc_prf_in')?.textContent || '',
    affiliation: document.querySelector('.gsc_prf_il')?.textContent || '',
    citations: Array.from(document.querySelectorAll('#gsc_rsb_st tr')).map(row => ({
      metric: row.querySelector('td:first-child')?.textContent || '',
      all: row.querySelector('td:nth-child(2)')?.textContent || '',
      since2018: row.querySelector('td:last-child')?.textContent || ''
    })),
    publications: Array.from(document.querySelectorAll('#gsc_a_b .gsc_a_tr')).map(pub => ({
      title: pub.querySelector('.gsc_a_t a')?.textContent || '',
      authors: pub.querySelector('.gsc_a_t .gsc_a_at')?.textContent || '',
      venue: pub.querySelector('.gsc_a_t .gsc_a_v')?.textContent || '',
      year: pub.querySelector('.gsc_a_y')?.textContent || '',
      citations: parseInt(pub.querySelector('.gsc_a_c')?.textContent || '0'),
      url: pub.querySelector('.gsc_a_t a')?.getAttribute('href') || ''
    })),
    coauthors: Array.from(document.querySelectorAll('#gsc_rsb_co .gsc_rsb_a_desc')).map(coauthor => ({
      name: coauthor.querySelector('.gsc_rsb_a_desc a')?.textContent || '',
      imageUrl: coauthor.querySelector('img')?.src || '',
      profileUrl: coauthor.querySelector('a')?.href || ''
    }))
  };

  return data;
}

function calculateAdvancedMetrics(data: any) {
  const totalPubs = data.publications.length;
  const pubsByYear: Record<string, number> = {};
  let selfCitations = 0;
  let totalCitations = 0;
  
  // Calculate publications per year
  data.publications.forEach((pub: any) => {
    if (pub.year) {
      pubsByYear[pub.year] = (pubsByYear[pub.year] || 0) + 1;
    }
    totalCitations += pub.citations;
  });

  // Calculate average publications per year
  const years = Object.keys(pubsByYear);
  const avgPubsPerYear = totalPubs / years.length;

  // Estimate self-citation rate (simplified version)
  const authorName = data.name.split(' ')[1]; // Last name
  data.publications.forEach((pub: any) => {
    if (pub.authors.includes(authorName)) {
      selfCitations += Math.round(pub.citations * 0.2); // Estimated self-citation rate
    }
  });

  const scrRate = (selfCitations / totalCitations) * 100;
  const sIndex = (data.publications.filter((p: any) => p.citations > 0).length / totalPubs) * 100;
  
  return {
    totalPublications: totalPubs,
    publicationsPerYear: avgPubsPerYear.toFixed(1),
    selfCitationRate: scrRate.toFixed(1) + '%',
    sIndex: sIndex.toFixed(1) + '%',
    hpIndex: Math.round(data.citations[0].all * 0.8), // Simplified pure h-index
    rcr: ((totalCitations / totalPubs) / 10).toFixed(2) // Simplified RCR
  };
}

function injectMetricsUI(metrics: any) {
  const container = document.createElement('div');
  container.className = 'scholar-folio-container';

  // Add styles safely
  const style = document.createElement('style');
  style.textContent = `
    .scholar-folio-container {
      margin: 20px 0;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border: 1px solid rgba(0,0,0,0.1);
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .metric-card {
      background: rgba(255, 255, 255, 0.9);
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    .metric-title {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e40af;
    }
    .metrics-header {
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `;
  container.appendChild(style);

  // Build metrics grid using safe DOM APIs
  const grid = document.createElement('div');
  grid.className = 'metrics-grid';

  Object.entries(metrics).forEach(([key, value]) => {
    const card = document.createElement('div');
    card.className = 'metric-card';

    const title = document.createElement('div');
    title.className = 'metric-title';
    title.textContent = key.replace(/([A-Z])/g, ' $1').trim();

    const val = document.createElement('div');
    val.className = 'metric-value';
    val.textContent = String(value);

    card.appendChild(title);
    card.appendChild(val);
    grid.appendChild(card);
  });

  container.appendChild(grid);

  const profileHeader = document.querySelector('#gsc_prf_i');
  if (profileHeader) {
    profileHeader.appendChild(container);
  }
}

// Listen for profile page loads
if (window.location.pathname.includes('/citations')) {
  const profileData = scrapeProfileData();
  const advancedMetrics = calculateAdvancedMetrics(profileData);
  
  chrome.runtime.sendMessage({ 
    type: 'PROFILE_DATA',
    data: { ...profileData, ...advancedMetrics }
  }, (response) => {
    chrome.runtime.sendMessage({ type: 'GET_METRICS' }, (metrics) => {
      if (metrics) {
        injectMetricsUI(metrics);
      }
    });
  });

  // Fetch co-author metrics
  profileData.coauthors.forEach(async (coauthor: any) => {
    if (coauthor.profileUrl) {
      try {
        const response = await fetch(coauthor.profileUrl);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        const citations = doc.querySelector('#gsc_rsb_st tr:first-child td:nth-child(2)')?.textContent || '0';
        const hIndex = doc.querySelector('#gsc_rsb_st tr:nth-child(2) td:nth-child(2)')?.textContent || '0';
        
        coauthor.citations = parseInt(citations);
        coauthor.hIndex = parseInt(hIndex);
        
        // Update UI with co-author metrics using safe DOM APIs
        const coauthorElement = document.querySelector(`a[href="${CSS.escape(coauthor.profileUrl)}"]`)?.parentElement;
        if (coauthorElement) {
          const metricsDiv = document.createElement('div');
          metricsDiv.className = 'coauthor-metrics';
          const span = document.createElement('span');
          span.className = 'text-sm text-gray-600';
          span.textContent = `${citations} citations \u2022 h-index: ${hIndex}`;
          metricsDiv.appendChild(span);
          coauthorElement.appendChild(metricsDiv);
        }
      } catch (error) {
        console.error('Error fetching co-author metrics:', error);
      }
    }
  });
}