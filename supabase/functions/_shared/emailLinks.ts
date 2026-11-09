/**
 * Tag every link back to the site in an outgoing email with
 * utm_source=email&utm_medium=email&utm_campaign=<kind>, so the visits each
 * email kind brings show up in analytics. Applied once in sendEmail, so a new
 * email kind is covered without touching its template.
 *
 * Left alone: the unsubscribe link (not a visit worth attributing), links that
 * already carry a utm_source, and site URLs nested percent-encoded inside
 * another URL (e.g. a LinkedIn share link: the shared URL must not say "email").
 * Plain Deno/Node-agnostic TS so vitest can import it.
 */

const SITE_LINK = /https:\/\/(?:www\.)?scholarfolio\.org(?:[/?#][^\s"'<>]*)?/g;
const TRAILING_PUNCT = /[.,;:!?)\]]+$/;

function tagOne(raw: string, campaign: string): string {
  const trailing = raw.match(TRAILING_PUNCT)?.[0] ?? '';
  const link = trailing ? raw.slice(0, -trailing.length) : raw;
  // HTML bodies may hold &amp;-escaped query strings; keep that encoding.
  const escaped = link.includes('&amp;');
  let url: URL;
  try {
    url = new URL(escaped ? link.replace(/&amp;/g, '&') : link);
  } catch {
    return raw;
  }
  if (url.pathname.startsWith('/unsubscribe') || url.searchParams.has('utm_source')) return raw;
  url.searchParams.set('utm_source', 'email');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', campaign);
  const out = url.toString();
  return (escaped ? out.replace(/&/g, '&amp;') : out) + trailing;
}

export function tagEmailLinks(content: string, campaign: string): string {
  return content.replace(SITE_LINK, (m) => tagOne(m, campaign));
}
