/**
 * Embeddable citation badge (served by netlify/functions/badge.ts). The
 * snippet gets pasted into other people's sites, so everything interpolated
 * into it is stripped to a safe character set first.
 */
export function badgeUrlFor(authorId: string): string {
  const safeId = authorId.replace(/[^a-zA-Z0-9_:-]/g, '');
  return `https://scholarfolio.org/badge/${safeId}.svg`;
}

export function badgeEmbedCode(authorId: string, authorName: string, profileUrl: string): string {
  const safeName = authorName.replace(/[<>"&]/g, '');
  const safeHref = profileUrl.replace(/["<>]/g, '');
  return `<a href="${safeHref}">
  <img src="${badgeUrlFor(authorId)}" alt="${safeName} on ScholarFolio" height="20">
</a>`;
}
