import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { NameSearchInput } from '../NameSearchInput';

const autocomplete = vi.fn();
vi.mock('../../services/openalex/name-suggestions', () => ({
  fetchAuthorAutocomplete: (q: string, signal?: AbortSignal) => autocomplete(q, signal),
}));

const results = [
  { id: 'A1', name: 'Tim Hilken', institution: 'Maastricht University', citedBy: 2707 },
  { id: 'A2', name: 'Tim Hilkert', institution: '', citedBy: 3 },
];

async function typeAndWait(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  await act(async () => { vi.advanceTimersByTime(300); });
}

describe('NameSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    autocomplete.mockReset();
    autocomplete.mockResolvedValue(results);
  });
  afterEach(() => vi.useRealTimers());

  it('shows suggestions and picks one with the keyboard', async () => {
    const onSearch = vi.fn();
    render(<NameSearchInput onSearch={onSearch} isLoading={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await typeAndWait(input, 'Tim Hilk');

    expect(autocomplete).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('Tim Hilken');
  });

  it('closes on Escape and submits free text on Enter', async () => {
    const onSearch = vi.fn();
    render(<NameSearchInput onSearch={onSearch} isLoading={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await typeAndWait(input, 'Tim Hilk');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.submit(input.closest('form')!);
    expect(onSearch).toHaveBeenCalledWith('Tim Hilk');
  });

  it('never asks for suggestions for a pasted Scholar link or profile id', async () => {
    render(<NameSearchInput onSearch={vi.fn()} isLoading={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await typeAndWait(input, 'https://scholar.google.com/citations?user=NOSPtp8AAAAJ');
    await typeAndWait(input, 'NOSPtp8AAAAJ');
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it('debounces typing into one request', async () => {
    render(<NameSearchInput onSearch={vi.fn()} isLoading={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Dom' } });
    fireEvent.change(input, { target: { value: 'Domi' } });
    await typeAndWait(input, 'Domin');
    expect(autocomplete).toHaveBeenCalledTimes(1);
    expect(autocomplete.mock.calls[0][0]).toBe('Domin');
  });
});
