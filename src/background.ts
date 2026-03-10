// Store for profile data
let currentProfileData: any = null;

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROFILE_DATA') {
    currentProfileData = request.data;
    console.log('Received profile data:', currentProfileData);
    // Calculate additional metrics
    const metrics = calculateMetrics(currentProfileData);
    // Store the complete data
    chrome.storage.local.set({ scholarFolio: metrics });
    sendResponse({ success: true });
  }

  if (request.type === 'GET_METRICS') {
    chrome.storage.local.get(['scholarFolio'], (result) => {
      sendResponse(result.scholarFolio || null);
    });
    return true; // Required for async response
  }
});

function calculateMetrics(data: any) {
  // Sort citations in descending order for h-index calculation
  const citations = data.publications
    .map((pub: any) => parseInt(pub.citations) || 0)
    .sort((a: number, b: number) => b - a);

  // Calculate h-index
  let hIndex = 0;
  for (let i = 0; i < citations.length; i++) {
    if (citations[i] >= i + 1) {
      hIndex = i + 1;
    } else {
      break;
    }
  }

  // Calculate g-index
  let gIndex = 0;
  let sum = 0;
  for (let i = 0; i < citations.length; i++) {
    sum += citations[i];
    if (sum >= Math.pow(i + 1, 2)) {
      gIndex = i + 1;
    } else {
      break;
    }
  }

  // Calculate i10-index
  const i10Index = citations.filter(c => c >= 10).length;

  // Calculate total citations
  const totalCitations = citations.reduce((a, b) => a + b, 0);

  // Group citations by year
  const citationsByYear: Record<string, number> = {};
  data.publications.forEach((pub: any) => {
    const year = pub.year;
    if (year && !isNaN(year)) {
      citationsByYear[year] = (citationsByYear[year] || 0) + (parseInt(pub.citations) || 0);
    }
  });

  return {
    name: data.name,
    affiliation: data.affiliation,
    hIndex,
    gIndex,
    i10Index,
    totalCitations,
    citationsPerYear: citationsByYear
  };
}