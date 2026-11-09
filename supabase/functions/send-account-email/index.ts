import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { jsonResponse, sendEmail } from "../_shared/mailer.ts";

/**
 * Sends one transactional account email on behalf of a Netlify function.
 * The Resend key lives only in Supabase secrets, so Netlify functions that
 * need to mail (placeholder-email-change) call this instead of holding a
 * second copy of the key.
 *
 * Auth: the caller must present the project's service-role key as a bearer
 * token; only server-side code holds it. Deploy with --no-verify-jwt.
 * POST { to, subject, html, text, kind, userId? }
 */

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", SERVICE_ROLE_KEY);

// Only kinds a server-side account flow sends; anything else is refused so a
// leaked call path can't turn this into a general-purpose mailer.
const ALLOWED_KINDS = new Set(["email_change"]);

function isServiceRole(req: Request): boolean {
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  return SERVICE_ROLE_KEY.length > 0 && bearer === SERVICE_ROLE_KEY;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!isServiceRole(req)) return jsonResponse({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const { to, subject, html, text, kind, userId } = body;
  if (
    typeof to !== "string" || typeof subject !== "string" || typeof html !== "string" ||
    typeof text !== "string" || typeof kind !== "string" || !ALLOWED_KINDS.has(kind)
  ) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const result = await sendEmail(supabase, {
    to, subject, html, text, kind,
    unsubToken: null,
    userId: typeof userId === "string" ? userId : null,
  });
  return result.ok
    ? jsonResponse({ ok: true, id: result.id ?? null })
    : jsonResponse({ ok: false, error: result.error ?? "send_failed" }, 502);
});
