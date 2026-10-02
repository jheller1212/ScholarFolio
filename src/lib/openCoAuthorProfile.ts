import { scholarService } from '../services/scholar';
import { logCaughtError } from './errorLogger';

const LOADING_PAGE = (name: string) => `<!DOCTYPE html><html><head><title>Scholar Folio</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafa;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#334155}.wrap{text-align:center}.spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#2d7d7d;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}.title{font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px}.sub{font-size:13px;color:#64748b}</style></head><body><div class="wrap"><div class="spinner"></div><div class="title">Loading profile</div><div class="sub">${name.replace(/'/g, '&#39;')}</div></div></body></html>`;

const scholarSearchUrl = (name: string) =>
  `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(name)}`;

/** Open a new tab showing a spinner; call synchronously inside a click handler. */
export function openLoadingTab(name: string): Window | null {
  const newWindow = window.open('about:blank', '_blank');
  if (newWindow) {
    newWindow.document.write(LOADING_PAGE(name));
    newWindow.document.close();
  }
  return newWindow;
}

/**
 * Open a co-author's ScholarFolio profile in a new tab, resolving their Scholar
 * id by name. The tab is opened synchronously (call this inside the click
 * handler) so popup blockers allow it; it shows a spinner until resolved.
 *
 * `notFound`: 'close' closes the tab, 'scholar-search' falls back to Google
 * Scholar's author search for the name.
 */
export async function openCoAuthorProfile(
  name: string,
  notFound: 'close' | 'scholar-search',
  source: string
): Promise<void> {
  const newWindow = openLoadingTab(name);
  const giveUp = () => {
    if (!newWindow) return;
    if (notFound === 'close') newWindow.close();
    else newWindow.location.href = scholarSearchUrl(name);
  };
  try {
    const results = await scholarService.searchAuthors(name);
    if (results.length >= 1 && newWindow) {
      newWindow.location.href = `${window.location.origin}/scholar/${encodeURIComponent(results[0].authorId)}`;
    } else {
      giveUp();
    }
  } catch (err) {
    logCaughtError(err, 'profile', source, 'author-link-search', { authorName: name });
    giveUp();
  }
}
