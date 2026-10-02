import { vi } from 'vitest';
import {
  savePendingAuthIntent,
  readPendingAuthIntent,
  takePendingAuthIntent,
  clearPendingAuthIntent,
} from '../pendingAuthIntent';

const URL_A = 'https://scholar.google.com/citations?user=abcdefghijkl';

// The jsdom build here doesn't expose a working localStorage; a Map-backed
// stand-in is enough for what this module touches.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
});

describe('pendingAuthIntent', () => {
  beforeEach(() => localStorage.clear());

  test('round-trips an intent', () => {
    savePendingAuthIntent({ url: URL_A, nameFallback: 'Ada Lovelace', claim: true }, 1000);
    expect(readPendingAuthIntent(2000)).toEqual({ url: URL_A, nameFallback: 'Ada Lovelace', claim: true, savedAt: 1000 });
  });

  test('take clears it so it only fires once', () => {
    savePendingAuthIntent({ url: URL_A }, 1000);
    expect(takePendingAuthIntent(2000)?.url).toBe(URL_A);
    expect(takePendingAuthIntent(2000)).toBeNull();
  });

  test('expires after a day', () => {
    savePendingAuthIntent({ url: URL_A }, 0);
    expect(readPendingAuthIntent(24 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  test('ignores malformed storage', () => {
    localStorage.setItem('sf_pending_auth_intent', '{not json');
    expect(readPendingAuthIntent()).toBeNull();
    localStorage.setItem('sf_pending_auth_intent', JSON.stringify({ url: 42, savedAt: 1 }));
    expect(readPendingAuthIntent(2)).toBeNull();
  });

  test('drops non-boolean claim flags', () => {
    localStorage.setItem('sf_pending_auth_intent', JSON.stringify({ url: URL_A, claim: 'yes', savedAt: 1 }));
    expect(readPendingAuthIntent(2)).toEqual({ url: URL_A, savedAt: 1 });
  });

  test('clear removes it', () => {
    savePendingAuthIntent({ url: URL_A });
    clearPendingAuthIntent();
    expect(readPendingAuthIntent()).toBeNull();
  });
});
