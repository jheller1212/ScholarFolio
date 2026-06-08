import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const ADMIN_EMAIL = "jonasheller89@gmail.com";
const FROM_EMAIL = "Scholar Folio <info@scholarfolio.org>";

const ALLOWED_ORIGINS = [
  "https://scholarfolio.org",
  "https://www.scholarfolio.org",
  "https://scholarfolio.netlify.app",
  "http://localhost:5173",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+--scholarfolio\.netlify\.app$/.test(origin))
    return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate — admin only
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);

    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Action: resolve user IDs to emails
    if (action === "resolve-emails") {
      const { userIds } = body as { userIds: string[] };
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "userIds must be a non-empty array" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const emailMap: Record<string, string> = {};
      for (const uid of userIds.slice(0, 50)) {
        const { data } = await supabase.auth.admin.getUserById(uid);
        if (data?.user?.email) {
          emailMap[uid] = data.user.email;
        }
      }

      return new Response(JSON.stringify({ emailMap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: send email
    if (action === "send") {
      const { to, subject, body: emailBody } = body as {
        to: string;
        subject: string;
        body: string;
      };

      if (!to || !subject || !emailBody) {
        return new Response(
          JSON.stringify({ error: "to, subject, and body are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        return new Response(
          JSON.stringify({ error: "RESEND_API_KEY not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html: emailBody,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        console.error("Resend error:", errBody);
        return new Response(
          JSON.stringify({ error: "Failed to send email", detail: errBody }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const resendData = await resendRes.json();
      return new Response(
        JSON.stringify({ success: true, emailId: resendData.id }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "send" or "resolve-emails".' }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-email error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
