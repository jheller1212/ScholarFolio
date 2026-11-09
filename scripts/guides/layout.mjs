// Shared HTML shell for the static grant guides in public/guides/.
// The app is a client-rendered SPA, so these pages are deliberately plain,
// fully server-rendered HTML: it is what crawlers and answer engines see.

export const SITE = 'https://scholarfolio.org';

export function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// JSON-LD lives inside <script>; escaping "<" keeps "</script>" in text inert.
export function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}

export function appLink(guide) {
  const params = new URLSearchParams({ tab: 'cv' });
  if (guide.format) params.set('format', guide.format);
  params.set('utm_source', 'guide');
  params.set('utm_medium', 'organic');
  params.set('utm_campaign', guide.slug);
  return `/?${params.toString()}`;
}

const CSS = `
@font-face{font-family:'DM Sans';font-weight:400;font-display:swap;src:url('/fonts/dm-sans-400-latin.woff2') format('woff2')}
@font-face{font-family:'DM Sans';font-weight:600;font-display:swap;src:url('/fonts/dm-sans-600-latin.woff2') format('woff2')}
@font-face{font-family:'Playfair Display';font-weight:700;font-display:swap;src:url('/fonts/playfair-display-700-latin.woff2') format('woff2')}
:root{--bg:#f8fafc;--card:#fff;--text:#1e293b;--muted:#475569;--soft:#64748b;--line:#e2e8f0;--teal:#2d7d7d;--teal-dark:#246666;--teal-bg:#eef7f7;--warn-bg:#fffbeb;--warn-line:#fcd34d}
html.dark{--bg:#030712;--card:#0f172a;--text:#f1f5f9;--muted:#cbd5e1;--soft:#94a3b8;--line:#1e293b;--teal:#3d9494;--teal-dark:#2d7d7d;--teal-bg:#0b2626;--warn-bg:#1c1606;--warn-line:#854d0e}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:400 17px/1.7 'DM Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--teal)}
a:hover{color:var(--teal-dark)}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:var(--card)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.brand{font:700 22px/1 'Playfair Display',Georgia,serif;text-decoration:none;color:var(--text)}
.brand span{color:var(--teal)}
header.site nav a{font-size:15px;margin-left:18px;text-decoration:none}
.crumbs{font-size:14px;color:var(--soft);margin:28px 0 8px}
.crumbs a{color:var(--soft)}
h1{font:700 clamp(30px,5vw,42px)/1.15 'Playfair Display',Georgia,serif;margin:0 0 16px}
h2{font:700 26px/1.25 'Playfair Display',Georgia,serif;margin:44px 0 12px}
h3{font-size:18px;margin:26px 0 6px}
.lede{font-size:19px;color:var(--muted)}
.meta{font-size:14px;color:var(--soft)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin:24px 0}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{text-align:left;vertical-align:top;padding:9px 10px;border-bottom:1px solid var(--line)}
th{width:34%;color:var(--soft);font-weight:600}
.table-scroll{overflow-x:auto}
ol.steps{counter-reset:s;list-style:none;padding:0}
ol.steps>li{counter-increment:s;position:relative;padding:0 0 18px 48px}
ol.steps>li::before{content:counter(s);position:absolute;left:0;top:0;width:32px;height:32px;border-radius:50%;background:var(--teal);color:#fff;font-weight:600;display:flex;align-items:center;justify-content:center}
ol.steps strong{display:block}
.cta{background:var(--teal-bg);border:1px solid var(--teal);border-radius:16px;padding:24px;margin:32px 0;text-align:center}
.cta p{margin:0 0 14px;color:var(--muted)}
.btn{display:inline-block;background:var(--teal);color:#fff!important;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:10px}
.btn:hover{background:var(--teal-dark)}
.note{background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:12px;padding:14px 18px;font-size:15px}
details{border-bottom:1px solid var(--line);padding:14px 0}
summary{cursor:pointer;font-weight:600}
details p{margin:10px 0 0;color:var(--muted)}
.sources li{font-size:15px;margin-bottom:6px;word-break:break-word}
ul.guides{list-style:none;padding:0}
ul.guides li{margin:0 0 14px}
ul.guides a{font-weight:600}
ul.guides span{display:block;font-size:15px;color:var(--muted)}
footer.site{margin-top:56px;border-top:1px solid var(--line);padding:28px 0 40px;font-size:14px;color:var(--soft)}
footer.site a{color:var(--soft)}
`;

// Mirrors the app's ThemeToggle ('sf_theme': light | dark | system).
const THEME_SCRIPT = `<script>try{var t=localStorage.getItem('sf_theme');if(t==='dark'||((t==='system'||!t)&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}</script>`;

// Supabase URL + publishable key for the page_view beacon. Both are public by
// design (the app bundle ships the same pair); they are read from the env at
// generation time so a key rotation is a config change plus a re-run, never a
// source edit. Missing values fail the build instead of shipping a dead beacon.
function analyticsConfig() {
  try { process.loadEnvFile?.(); } catch { /* no .env file: rely on the shell env */ }
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('scripts/guides: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see .env.example)');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

// The guides are static HTML outside the SPA, so they log their own page_view
// into the same analytics_events table the app writes to, through the same
// public anon insert. It mirrors the app's privacy model: the per-tab random
// session id in sessionStorage ('sf_session_id', shared with the app so a guide
// reader who clicks through stays one session), no cookies, no personal data.
// `landing` marks the first page of the tab session (acquisition counting).
export function analyticsScript(notFound = false) {
  const { url, key } = analyticsConfig();
  const endpoint = JSON.stringify(`${url}/rest/v1/analytics_events`);
  return `<script>(function(){try{var s=sessionStorage,id=s.getItem('sf_session_id'),landing=!id;if(!id){id=crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),function(b){return b.toString(16).padStart(2,'0')}).join('');s.setItem('sf_session_id',id)}var q=new URLSearchParams(location.search),r=document.referrer||'direct',p=location.pathname;fetch(${endpoint},{method:'POST',keepalive:true,headers:{apikey:${JSON.stringify(key)},'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({event:'page_view',session_id:id,referrer:r,pathname:p,properties:{page_type:'guide',path:p,landing:landing,referrer:r,utm_source:q.get('utm_source'),utm_medium:q.get('utm_medium'),utm_campaign:q.get('utm_campaign')${notFound ? ',not_found:true' : ''}}})}).catch(function(){})}catch(e){}})();</script>`;
}

// noindex: for the guides 404 page, served at whatever URL was requested, so
// it must not claim a canonical or og:url of its own.
export function page({ path, title, description, ogType = 'article', body, structuredData = [], noindex = false }) {
  const url = `${SITE}${path}`;
  const identity = noindex
    ? '<meta name="robots" content="noindex">'
    : `<link rel="canonical" href="${url}">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${identity}
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2">
<meta name="theme-color" content="#1e293b">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="ScholarFolio">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${noindex ? '' : `<meta property="og:url" content="${url}">\n`}<meta property="og:image" content="${SITE}/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${THEME_SCRIPT}
<style>${CSS.trim()}</style>
${structuredData.map(jsonLd).join('\n')}
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="/">Scholar<span>Folio</span></a><nav><a href="/guides/">Guides</a><a href="/">Open the app</a></nav></div></header>
<main class="wrap">
${body}
</main>
<footer class="site"><div class="wrap">
<p>ScholarFolio is a free, open-source academic project. Guides summarise official funder documents; the funder's current call text always takes precedence.</p>
<p><a href="/guides/">All guides</a> · <a href="/">ScholarFolio</a> · <a href="/about">About</a> · <a href="/privacy">Privacy</a></p>
</div></footer>
${analyticsScript(noindex)}
</body>
</html>
`;
}
