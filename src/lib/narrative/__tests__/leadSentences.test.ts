import { describe, it, expect } from 'vitest';
import { splitSentences, leadSentences } from '../leadSentences';

describe('splitSentences', () => {
  it('splits plain sentences', () => {
    expect(splitSentences('One here. Two here. Three.')).toEqual(['One here.', 'Two here.', 'Three.']);
  });

  it('does not split on initials or abbreviations', () => {
    expect(splitSentences('J. Smith works with Prof. Jones et al. on things. Next one.')).toEqual([
      'J. Smith works with Prof. Jones et al. on things.',
      'Next one.',
    ]);
  });

  it('keeps bold markers attached to the sentence they close', () => {
    expect(splitSentences('First appeared in **2019**. Spans **12** years.')).toEqual([
      'First appeared in **2019**.',
      'Spans **12** years.',
    ]);
  });

  it('does not split decimals', () => {
    expect(splitSentences('An FWCI of 1.5 overall. Done.')).toEqual(['An FWCI of 1.5 overall.', 'Done.']);
  });
});

describe('leadSentences', () => {
  it('reports truncation when more sentences exist', () => {
    expect(leadSentences(['A one. B two. C three.'], 2)).toEqual({ lead: 'A one. B two.', truncated: true });
  });

  it('reports truncation when more paragraphs exist', () => {
    expect(leadSentences(['A one.', 'Second paragraph.'], 2)).toEqual({ lead: 'A one.', truncated: true });
  });

  it('is not truncated when everything fits', () => {
    expect(leadSentences(['A one. B two.'], 2)).toEqual({ lead: 'A one. B two.', truncated: false });
    expect(leadSentences([], 2)).toEqual({ lead: '', truncated: false });
  });
});
