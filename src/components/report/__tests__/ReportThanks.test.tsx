import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const sendReportFeedback = vi.fn(async () => {});
vi.mock('../../../services/reports', () => ({ sendReportFeedback: (...a: unknown[]) => sendReportFeedback(...(a as [])) }));

import { ReportThanks } from '../ReportThanks';

describe('ReportThanks', () => {
  it('thanks without any credits offer and promises an email only when one was left', () => {
    const { rerender } = render(<ReportThanks reportId="r1" willNotify onClose={() => {}} />);
    expect(screen.getByText(/email you as soon as it's fixed/i)).toBeInTheDocument();
    expect(screen.queryByText(/credit/i)).toBeNull();
    rerender(<ReportThanks reportId="r1" willNotify={false} onClose={() => {}} />);
    expect(screen.getByText(/leave an email next time/i)).toBeInTheDocument();
  });

  it('asks one question and records the answer once', () => {
    render(<ReportThanks reportId="r1" willNotify onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(sendReportFeedback).toHaveBeenCalledWith('r1', 3);
    expect(screen.queryByRole('button', { name: 'Okay' })).toBeNull();
    expect(screen.getByText(/thanks for the feedback/i)).toBeInTheDocument();
  });
});
