// Supabase Edge Function: meta-capi
// Receives a "Schedule" conversion event from a confirmation page and forwards it
// server-side to Meta's Conversions API, deduplicated with the browser pixel via
// a shared event_id. No monetary value is attached (per business decision: these
// are unmonetized booking events, not closed sales).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://goviralads.agency", "https://www.goviralads.agency"];
const GRAPH_API_VERSION = "v25.0";
const PIXEL_ID = "2188318194947797";

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const eventId = typeof body.event_id === "string" ? body.event_id : null;
  const eventSourceUrl = typeof body.event_source_url === "string" ? body.event_source_url : null;
  const fbp = typeof body.fbp === "string" ? body.fbp : undefined;
  const fbc = typeof body.fbc === "string" ? body.fbc : undefined;
  const testEventCode = typeof body.test_event_code === "string" ? body.test_event_code : undefined;

  if (!eventId || !eventSourceUrl || !ALLOWED_ORIGINS.some((o) => eventSourceUrl.startsWith(o + "/"))) {
    return new Response(JSON.stringify({ error: "Missing or invalid event_id/event_source_url" }), {
      status: 400,
      headers
    });
  }

  // x-forwarded-for may carry a client-supplied value with our own gateway's real
  // detection appended after it; the LAST entry is the one to trust, not the first.
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor
    ? forwardedFor
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .pop()
    : undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: token, error: tokenErr } = await supabase.rpc("get_meta_capi_token");
  if (tokenErr || !token) {
    console.error("meta-capi: failed to read CAPI token from vault", tokenErr);
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers });
  }

  const userData: Record<string, string> = {};
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const eventPayload: Record<string, unknown> = {
    event_name: "Schedule",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: eventSourceUrl,
    action_source: "website",
    user_data: userData
  };

  const graphPayload: Record<string, unknown> = { data: [eventPayload] };
  if (testEventCode) graphPayload.test_event_code = testEventCode;

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graphPayload)
      }
    );
    const metaJson = await metaRes.json();
    if (!metaRes.ok) {
      console.error("meta-capi: Graph API error", JSON.stringify(metaJson));
      return new Response(JSON.stringify({ error: "Meta API error", detail: metaJson }), {
        status: 502,
        headers
      });
    }
    return new Response(JSON.stringify({ success: true, meta: metaJson }), { status: 200, headers });
  } catch (err) {
    console.error("meta-capi: upstream request failed", err);
    return new Response(JSON.stringify({ error: "Upstream request failed" }), { status: 502, headers });
  }
});
