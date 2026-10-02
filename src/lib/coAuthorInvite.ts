/**
 * Prefilled "claim your profile" message a researcher can send a co-author.
 * We never have co-authors' email addresses, so the owner sends it themselves
 * (share sheet or clipboard).
 */
export function buildInviteMessage(params: {
  coAuthorName: string;
  ownerName: string;
  sharedPapers: number;
  /** Direct link to the co-author's ScholarFolio page, when we know their Scholar id. */
  profileLink: string | null;
  siteUrl: string;
}): string {
  const first = params.coAuthorName.trim().split(/\s+/)[0] || params.coAuthorName;
  const shared = params.sharedPapers > 0
    ? ` (we have ${params.sharedPapers} paper${params.sharedPapers === 1 ? '' : 's'} together)`
    : '';
  const where = params.profileLink
    ? `Your profile is already there: ${params.profileLink}`
    : `You can find your own profile by searching your name at ${params.siteUrl}`;
  return [
    `Hi ${first},`,
    '',
    `I put my research profile on ScholarFolio, a free, open-source tool built on Google Scholar and OpenAlex, and you show up among my co-authors${shared}.`,
    `${where} — claiming it is free and lets you correct details and get a short link.`,
    '',
    params.ownerName,
  ].join('\n');
}
