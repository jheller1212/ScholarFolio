import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * Email unsubscribe by token — no login required, so the link works from any
 * mail client (GDPR/ePrivacy requires withdrawal to be as easy as consent).
 *
 * POST only: mail scanners (Outlook Safe Links etc.) prefetch GET links, which
 * would silently unsubscribe users. The /unsubscribe page requires an explicit
 * click before POSTing; RFC 8058 one-click List-Unsubscribe also uses POST.
 *
 * Deploy with: supabase functions deploy unsubscribe --no-verify-jwt
 */

const ALLOWED_ORIGINS = [
  "https://scholarfolio.org",
  "https://www.scholarfolio.org",
  "https://scholarfolio.netlify.app",
  "http://localhost:5173",
];

function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }
  const body = await req.json().catch(() => ({}));
  const token: string | null = typeof body.token === "string" ? body.token : null;

  if (!token || !UUID_RE.test(token)) {
    return json({ error: "Invalid or missing token" }, 400, origin);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase
      .from("email_preferences")
      .update({
        digest_opt_in: false,
        marketing_opt_in: false,
        consent_source: "unsubscribe-link",
      })
      .eq("unsubscribe_token", token)
      .select("user_id");

    if (error) {
      console.error("unsubscribe update error:", error);
      return json({ error: "Server error" }, 500, origin);
    }
    if (!data || data.length === 0) {
      return json({ error: "Unknown token" }, 404, origin);
    }
    return json({ ok: true }, 200, origin);
  } catch (e) {
    console.error("unsubscribe error:", e);
    return json({ error: "Server error" }, 500, origin);
  }
});
