import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key — safe to embed, same as client-side
const supabaseAnonKey = 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

const handler: Handler = async () => {
  const staticPages = [
    { loc: 'https://scholarfolio.org/', changefreq: 'weekly', priority: '1.0' },
    { loc: 'https://scholarfolio.org/?page=changelog', changefreq: 'weekly', priority: '0.5' },
    { loc: 'https://scholarfolio.org/?page=privacy', changefreq: 'monthly', priority: '0.3' },
  ];

  // Fetch claimed profiles from Supabase
  let profileUrls: Array<{ loc: string; changefreq: string; priority: string }> = [];
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase
      .from('claimed_profiles')
      .select('slug, updated_at')
      .order('updated_at', { ascending: false });

    if (data) {
      profileUrls = data.map(profile => ({
        loc: `https://scholarfolio.org/${profile.slug}`,
        changefreq: 'weekly',
        priority: '0.8',
      }));
    }
  } catch {
    // Continue with static pages only
  }

  const allUrls = [...staticPages, ...profileUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
    body: xml,
  };
};

export { handler };
