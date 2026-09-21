import { vi } from 'vitest';

const insert = vi.fn(() => ({ then: (ok: () => void) => { ok(); } }));

vi.mock('../supabase', () => ({
  supabase: { from: () => ({ insert }) },
}));

const { logError } = await import('../errorLogger');

/** The row the logger would have written, or undefined if it wrote nothing. */
function lastRow(): Record<string, unknown> | undefined {
  return insert.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
}

describe('logError', () => {
  beforeEach(() => {
    insert.mockClear();
  });

  test('drops the benign ResizeObserver warning', () => {
    logError({ category: 'unhandled', message: 'ResizeObserver loop completed with undelivered notifications.' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('drops opaque cross-origin "Script error."', () => {
    logError({ category: 'unhandled', message: 'Script error.' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('drops rejections thrown by a wallet browser extension', () => {
    logError({ category: 'unhandled', message: 'Failed to connect to MetaMask' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('drops aborted requests', () => {
    logError({ category: 'profile', message: 'The operation was aborted' });
    expect(insert).not.toHaveBeenCalled();
  });

  test('still logs a real error', () => {
    logError({ category: 'profile', message: 'Unable to fetch profile data' });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(lastRow()?.message).toBe('Unable to fetch profile data');
  });

  test('never throws when context holds an unserializable value', () => {
    // A DOM node reaches context easily from an event handler; JSON.stringify of
    // one throws on the React fiber cycle, which used to surface as a logged
    // error from inside the logger.
    const node = document.createElement('a');
    const circular: Record<string, unknown> = { self: null };
    circular.self = circular;

    expect(() => logError({
      category: 'unhandled',
      message: 'real failure with a hostile context',
      context: { node, circular, keep: 'this', count: 3 },
    })).not.toThrow();

    const ctx = lastRow()?.context as Record<string, unknown>;
    expect(ctx.keep).toBe('this');
    expect(ctx.count).toBe(3);
    expect(typeof ctx.circular).toBe('string');
  });

  test('deduplicates a repeated message', () => {
    logError({ category: 'profile', message: 'same message twice' });
    logError({ category: 'profile', message: 'same message twice' });
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
