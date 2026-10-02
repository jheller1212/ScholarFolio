import { requestClaim, consumeClaimRequest } from '../claimRequest';

describe('claimRequest', () => {
  test('is consumed once, and only for the requested author', () => {
    requestClaim('abcdefghijkl');
    expect(consumeClaimRequest('someone-else')).toBe(false);
    expect(consumeClaimRequest('abcdefghijkl')).toBe(true);
    expect(consumeClaimRequest('abcdefghijkl')).toBe(false);
  });

  test('never matches an empty author id', () => {
    expect(consumeClaimRequest('')).toBe(false);
  });
});
