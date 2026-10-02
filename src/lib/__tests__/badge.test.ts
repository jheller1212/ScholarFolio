import { badgeUrlFor, badgeEmbedCode } from '../badge';

describe('badge', () => {
  test('builds the badge URL for Scholar and OpenAlex ids', () => {
    expect(badgeUrlFor('abcDEF_12-34')).toBe('https://scholarfolio.org/badge/abcDEF_12-34.svg');
    expect(badgeUrlFor('openalex:A123')).toBe('https://scholarfolio.org/badge/openalex:A123.svg');
  });

  test('strips markup from everything pasted into other sites', () => {
    const code = badgeEmbedCode('abc"><script>', 'Ada <b>"L"</b>', 'https://scholarfolio.org/ada"onload=x');
    expect(code).not.toMatch(/<script|<b>|"onload/);
    expect(code).toContain('href="https://scholarfolio.org/adaonload=x"');
  });
});
