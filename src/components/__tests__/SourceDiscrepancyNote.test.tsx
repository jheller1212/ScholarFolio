import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceDiscrepancyNote } from '../SourceDiscrepancyNote';
import type { Author } from '../../types/scholar';

const base = {
  totalCitations: 1200,
  publications: new Array(10).fill({ title: 't' }),
  openAccess: { openAlexCitations: 800, matchedWorks: 8 },
} as unknown as Author;

describe('SourceDiscrepancyNote', () => {
  it('shows both counts and the matched share', () => {
    render(<SourceDiscrepancyNote data={base} isOpenAlexProfile={false} />);
    expect(screen.getByText(/for the 8 of 10 publications it could match/)).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /full comparison/ })).toHaveAttribute('href', '/guides/google-scholar-vs-openalex');
  });

  it('renders nothing for OpenAlex-only profiles or without OpenAlex counts', () => {
    const { container, rerender } = render(<SourceDiscrepancyNote data={base} isOpenAlexProfile={true} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SourceDiscrepancyNote data={{ ...base, openAccess: undefined }} isOpenAlexProfile={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
