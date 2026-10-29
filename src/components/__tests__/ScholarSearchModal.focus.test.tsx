import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { ScholarSearchModal } from '../ScholarSearchModal';

vi.mock('../../services/scholar/index', () => ({
  scholarService: {
    scholarProfileUrlFrom: () => null,
    looksLikeUrl: () => false,
    searchAuthors: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../services/openalex', () => ({
  searchOpenAlexAuthors: vi.fn().mockResolvedValue([]),
  OPENALEX_ID_PREFIX: 'openalex:',
}));
vi.mock('../../services/openalex/name-suggestions', () => ({
  fetchNameSuggestions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/claimed-profiles', () => ({
  fetchClaimStatuses: vi.fn().mockResolvedValue(new Map()),
}));

describe('ScholarSearchModal focus', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('moves focus in when opened with a query, closes on Escape and returns focus', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();

    const { rerender } = render(
      <ScholarSearchModal isOpen onClose={onClose} onSelect={vi.fn()} initialQuery="Tim Hilken" />
    );
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Enter researcher name...'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ScholarSearchModal isOpen={false} onClose={onClose} onSelect={vi.fn()} />);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
