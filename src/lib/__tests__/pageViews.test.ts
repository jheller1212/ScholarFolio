import { vi } from 'vitest';

const trackEvent = vi.fn();
vi.mock('../analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { installPageViewTracking } from '../pageViews';

describe('installPageViewTracking', () => {
  test('logs route changes, skips same-type canonical redirects', () => {
    window.history.replaceState({}, '', '/');
    installPageViewTracking();
    expect(trackEvent).toHaveBeenLastCalledWith('page_view', { path: '/', page_type: 'home', prev_path: null });

    window.history.pushState({}, '', '/about');
    expect(trackEvent).toHaveBeenLastCalledWith('page_view', { path: '/about', page_type: 'other', prev_path: '/' });

    window.history.pushState({}, '', '/?user=abcdEFGH1234');
    window.history.replaceState({}, '', '/scholar/abcdEFGH1234');
    expect(trackEvent).toHaveBeenLastCalledWith('page_view', { path: '/', page_type: 'profile', prev_path: '/about' });

    // replaceState that changes page type (profile -> home) is a real navigation
    window.history.replaceState({}, '', '/');
    expect(trackEvent).toHaveBeenLastCalledWith('page_view', { path: '/', page_type: 'home', prev_path: '/scholar/abcdEFGH1234' });
    expect(trackEvent).toHaveBeenCalledTimes(4);
  });
});
