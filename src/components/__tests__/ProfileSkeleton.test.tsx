import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ProfileSkeleton } from '../ProfileSkeleton';

afterEach(() => vi.useRealTimers());

describe('ProfileSkeleton', () => {
  it('announces staged progress text', () => {
    vi.useFakeTimers();
    render(<ProfileSkeleton />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Fetching publications');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(status).toHaveTextContent('Computing metrics');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(status).toHaveTextContent('Writing narrative');
  });
});
