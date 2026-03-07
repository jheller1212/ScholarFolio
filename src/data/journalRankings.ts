// Journal rankings data with extended information
export const JOURNAL_RANKINGS: Record<string, {
  sjr?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  jcr?: string;
  ft50?: boolean;
  abs?: '4*' | '4' | '3' | '2' | '1';
  abdc?: 'A*' | 'A' | 'B' | 'C';
}> = {
  // FT50 Journals (Complete list)
  'academy of management journal': { sjr: 'Q1', jcr: '10.192', ft50: true, abs: '4*', abdc: 'A*' },
  'academy of management review': { sjr: 'Q1', jcr: '11.784', ft50: true, abs: '4*', abdc: 'A*' },
  'accounting organizations and society': { sjr: 'Q1', jcr: '3.947', ft50: true, abs: '4*', abdc: 'A*' },
  'administrative science quarterly': { sjr: 'Q1', jcr: '8.024', ft50: true, abs: '4*', abdc: 'A*' },
  'american economic review': { sjr: 'Q1', jcr: '7.145', ft50: true, abs: '4*', abdc: 'A*' },
  'contemporary accounting research': { sjr: 'Q1', jcr: '3.239', ft50: true, abs: '4', abdc: 'A*' },
  'econometrica': { sjr: 'Q1', jcr: '8.529', ft50: true, abs: '4*', abdc: 'A*' },
  'entrepreneurship theory and practice': { sjr: 'Q1', jcr: '10.075', ft50: true, abs: '4', abdc: 'A*' },
  'harvard business review': { sjr: 'Q1', jcr: '7.820', ft50: true, abs: '3', abdc: 'A' },
  'human relations': { sjr: 'Q1', jcr: '5.236', ft50: true, abs: '4', abdc: 'A*' },
  'human resource management': { sjr: 'Q1', jcr: '5.078', ft50: true, abs: '4', abdc: 'A*' },
  'information systems research': { sjr: 'Q1', jcr: '4.802', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of accounting and economics': { sjr: 'Q1', jcr: '4.936', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of accounting research': { sjr: 'Q1', jcr: '5.333', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of applied psychology': { sjr: 'Q1', jcr: '7.429', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of business ethics': { sjr: 'Q1', jcr: '6.973', ft50: true, abs: '3', abdc: 'A' },
  'journal of business venturing': { sjr: 'Q1', jcr: '10.214', ft50: true, abs: '4', abdc: 'A*' },
  'journal of consumer psychology': { sjr: 'Q1', jcr: '4.427', ft50: true, abs: '4', abdc: 'A*' },
  'journal of consumer research': { sjr: 'Q1', jcr: '5.000', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of finance': { sjr: 'Q1', jcr: '8.902', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of financial and quantitative analysis': { sjr: 'Q1', jcr: '4.147', ft50: true, abs: '4', abdc: 'A*' },
  'journal of financial economics': { sjr: 'Q1', jcr: '8.018', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of international business studies': { sjr: 'Q1', jcr: '9.158', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of management': { sjr: 'Q1', jcr: '11.791', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of management information systems': { sjr: 'Q1', jcr: '5.676', ft50: true, abs: '4', abdc: 'A*' },
  'journal of management studies': { sjr: 'Q1', jcr: '7.134', ft50: true, abs: '4', abdc: 'A*' },
  'journal of marketing': { sjr: 'Q1', jcr: '12.367', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of marketing research': { sjr: 'Q1', jcr: '5.921', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of operations management': { sjr: 'Q1', jcr: '8.892', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of political economy': { sjr: 'Q1', jcr: '8.302', ft50: true, abs: '4*', abdc: 'A*' },
  'journal of the academy of marketing science': { sjr: 'Q1', jcr: '11.421', ft50: true, abs: '4', abdc: 'A*' },
  'management science': { sjr: 'Q1', jcr: '4.883', ft50: true, abs: '4*', abdc: 'A*' },
  'manufacturing and service operations management': { sjr: 'Q1', jcr: '3.568', ft50: true, abs: '4', abdc: 'A*' },
  'marketing science': { sjr: 'Q1', jcr: '3.605', ft50: true, abs: '4*', abdc: 'A*' },
  'mis quarterly': { sjr: 'Q1', jcr: '5.921', ft50: true, abs: '4*', abdc: 'A*' },
  'operations research': { sjr: 'Q1', jcr: '3.494', ft50: true, abs: '4*', abdc: 'A*' },
  'organization science': { sjr: 'Q1', jcr: '4.683', ft50: true, abs: '4', abdc: 'A*' },
  'organization studies': { sjr: 'Q1', jcr: '5.712', ft50: true, abs: '4', abdc: 'A*' },
  'organizational behavior and human decision processes': { sjr: 'Q1', jcr: '4.853', ft50: true, abs: '4', abdc: 'A*' },
  'production and operations management': { sjr: 'Q1', jcr: '4.965', ft50: true, abs: '4', abdc: 'A*' },
  'quarterly journal of economics': { sjr: 'Q1', jcr: '11.375', ft50: true, abs: '4*', abdc: 'A*' },
  'research policy': { sjr: 'Q1', jcr: '8.995', ft50: true, abs: '4', abdc: 'A*' },
  'review of accounting studies': { sjr: 'Q1', jcr: '3.682', ft50: true, abs: '4', abdc: 'A*' },
  'review of economic studies': { sjr: 'Q1', jcr: '6.673', ft50: true, abs: '4*', abdc: 'A*' },
  'review of finance': { sjr: 'Q1', jcr: '3.494', ft50: true, abs: '4', abdc: 'A*' },
  'review of financial studies': { sjr: 'Q1', jcr: '7.256', ft50: true, abs: '4*', abdc: 'A*' },
  'sloan management review': { sjr: 'Q1', jcr: '7.548', ft50: true, abs: '3', abdc: 'A' },
  'strategic entrepreneurship journal': { sjr: 'Q1', jcr: '6.200', ft50: true, abs: '4', abdc: 'A*' },
  'strategic management journal': { sjr: 'Q1', jcr: '7.841', ft50: true, abs: '4*', abdc: 'A*' },
  'the accounting review': { sjr: 'Q1', jcr: '4.562', ft50: true, abs: '4*', abdc: 'A*' },

  // Non-FT50 Journals
  'proceedings of the national academy of sciences': { sjr: 'Q1', jcr: '11.205', abs: '4*', abdc: 'A*' },
  'nature': { sjr: 'Q1', jcr: '49.962', abs: '4*', abdc: 'A*' },
  'science': { sjr: 'Q1', jcr: '41.845', abs: '4*', abdc: 'A*' },
  'psychological science': { sjr: 'Q1', jcr: '6.585', abs: '4', abdc: 'A*' },
  'journal of experimental psychology': { sjr: 'Q1', jcr: '4.670', abs: '4', abdc: 'A*' },
  'psychological review': { sjr: 'Q1', jcr: '8.216', abs: '4*', abdc: 'A*' },
  'psychology and marketing': { sjr: 'Q1', jcr: '2.939', abs: '3', abdc: 'A' },
  'journal of business research': { sjr: 'Q1', jcr: '7.550', abs: '3', abdc: 'A' },
  'journal of retailing': { sjr: 'Q1', jcr: '7.590', abs: '4', abdc: 'A*' },
  'journal of service research': { sjr: 'Q1', jcr: '6.842', abs: '4', abdc: 'A*' },
  'journal of interactive marketing': { sjr: 'Q1', jcr: '4.719', abs: '3', abdc: 'A' },
  'journal of research in interactive marketing': { sjr: 'Q1', jcr: '3.417', abs: '2', abdc: 'A' },
  'journal of advertising': { sjr: 'Q1', jcr: '5.566', abs: '3', abdc: 'A*' },
  'computers in human behavior': { sjr: 'Q1', jcr: '7.959', abs: '3', abdc: 'A' },
  'international journal of physical distribution and logistics management': { sjr: 'Q1', jcr: '9.592', abs: '2', abdc: 'A' },
  'journal of wine research': { sjr: 'Q2', jcr: '1.426', abs: '2', abdc: 'B' },
  'international journal of information management': { sjr: 'Q1', jcr: '14.098', abs: '2', abdc: 'A' },
  'journal of service management': { sjr: 'Q1', jcr: '8.897', abs: '2', abdc: 'A' },
  'business horizons': { sjr: 'Q1', jcr: '7.430', abs: '2', abdc: 'B' },
  'journal of social marketing': { sjr: 'Q2', jcr: '3.207', abs: '2', abdc: 'B' },
  'australasian marketing journal': { sjr: 'Q2', jcr: '2.104', abs: '2', abdc: 'B' },
  'journal of retailing and consumer services': { sjr: 'Q1', jcr: '7.135', abs: '2', abdc: 'A' },
  'frontiers in sports and active living': { sjr: 'Q2', jcr: '2.231', abdc: 'C' },
  'advances in consumer research': { sjr: 'Q2', abs: '2', abdc: 'B' }
};

// Helper function to normalize a venue/journal name for matching
function normalizeVenueName(name: string): string {
  return name.toLowerCase()
    .replace(/,.*$/, '')           // Remove everything after first comma
    .replace(/\s+\d+.*$/, '')      // Remove volume/issue numbers and everything after
    .replace(/\([^)]*\)/g, '')     // Remove parenthetical content
    .replace(/proceedings.*$/i, '')
    .replace(/conference.*$/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:\-]/g, '')
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '');
}

// Helper function to find matching journal with strict matching logic
export function findJournalRanking(venue: string) {
  if (!venue) return undefined;

  const baseVenue = normalizeVenueName(venue);
  if (!baseVenue || baseVenue.length < 3) return undefined;

  // Try exact match first
  if (JOURNAL_RANKINGS[baseVenue]) {
    return JOURNAL_RANKINGS[baseVenue];
  }

  // Try substring containment: venue must fully contain the journal name
  // or the journal name must fully contain the venue
  for (const [journal, ranking] of Object.entries(JOURNAL_RANKINGS)) {
    if (baseVenue.includes(journal) || journal.includes(baseVenue)) {
      // Ensure the shorter string is at least 90% the length of the longer
      // to prevent "journal of finance" matching "journal of financial economics"
      const ratio = Math.min(baseVenue.length, journal.length) / Math.max(baseVenue.length, journal.length);
      if (ratio >= 0.85) {
        return ranking;
      }
    }
  }

  // Strict word matching: ALL significant words must match (not just 80%)
  const venueWords = baseVenue.split(' ').filter(w => w.length > 2);
  for (const [journal, ranking] of Object.entries(JOURNAL_RANKINGS)) {
    const journalWords = journal.split(' ').filter(w => w.length > 2);

    // All words in the shorter list must appear in the longer list
    const shorter = venueWords.length <= journalWords.length ? venueWords : journalWords;
    const longer = venueWords.length <= journalWords.length ? journalWords : venueWords;
    const allMatch = shorter.every(word => longer.includes(word));

    if (allMatch && shorter.length >= 3) {
      return ranking;
    }
  }

  return undefined;
}