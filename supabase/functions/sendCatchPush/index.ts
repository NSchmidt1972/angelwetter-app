import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY") ?? "";
const EDGE_SECRET = (Deno.env.get("EDGE_SECRET") ?? "").trim();

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function artikel(fish) {
  const dict = {
    Aal: "einen",
    Barsch: "einen",
    Brasse: "eine",
    Döbel: "einen",
    Forelle: "einen",
    Graskarpfen: "einen",
    Güster: "eine",
    Grundel: "eine",
    Hecht: "einen",
    Karausche: "eine",
    Karpfen: "einen",
    Quappe: "eine",
    Rotauge: "eine",
    Rotfeder: "eine",
    Schleie: "eine",
    Ukelei: "einen",
    Wels: "einen",
    Zander: "einen"
  };
  return dict[fish] ?? "einen";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors()
    });
  }

  try {
    const missingEnv = [
      ["SUPABASE_URL", SUPABASE_URL],
      ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
      ["ONESIGNAL_APP_ID", ONESIGNAL_APP_ID],
      ["ONESIGNAL_API_KEY", ONESIGNAL_API_KEY]
    ].filter(([, v]) => !v);

    if (missingEnv.length) {
      console.error("[send-push-notification] missing env vars:", missingEnv.map(([k]) => k));
      return json(500, {
        error: "Missing ENV",
        missing: missingEnv.map(([k]) => k)
        });
    }

    const accessToken = readBearerToken(req);
    if (!accessToken) {
      return json(401, {
        error: "Missing bearer token"
      });
    }

    const {
      data: { user: callerUser },
      error: callerError
    } = await supabase.auth.getUser(accessToken);
    if (callerError || !callerUser?.id) {
      console.warn("[send-push-notification] caller auth failed", {
        code: callerError?.code ?? null
      });
      return json(401, {
        error: "Invalid bearer token"
      });
    }

    const payload = await req.json().catch((err) => {
      console.error("[send-push-notification] JSON parse failed:", err);
      return {};
    });

    if (EDGE_SECRET) {
      const providedSecret = req.headers.get("x-edge-secret") ?? "";
      if (providedSecret !== EDGE_SECRET) {
        console.warn("[send-push-notification] invalid edge secret");
        return json(401, {
          error: "Unauthorized"
        });
      }
    }

    const record = payload.record ?? payload.new ?? payload ?? {};

    const angler = String(payload.angler ?? record.angler ?? "").trim();
    const fish = String(payload.fish ?? record.fish ?? "").trim();
    const sizeValue = payload.size ?? record.size ?? null;
    const sizeNum = sizeValue != null ? Number(sizeValue) || null : null;
    const clubIdRaw = payload.club_id ?? record.club_id ?? null;
    const clubId = typeof clubIdRaw === "string" ? clubIdRaw.trim() : null;
    let excludeUserId = record.user_id ? String(record.user_id) : null;

    if (!angler || !fish || !clubId) {
      console.warn("[send-push-notification] missing angler/fish/club – skipping");
      return json(400, {
        error: "Missing angler, fish or club_id"
      });
    }

    if (!UUID_REGEX.test(clubId)) {
      return json(400, {
        error: "Invalid club_id"
      });
    }

    const { data: membership, error: membershipErr } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("user_id", callerUser.id)
      .eq("club_id", clubId)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipErr) {
      console.error("[send-push-notification] membership check failed:", membershipErr);
      return json(500, {
        error: "Membership check failed"
      });
    }

    let callerAllowed = Boolean(membership?.user_id);
    if (!callerAllowed) {
      const { data: superadminRow, error: superadminErr } = await supabase
        .from("superadmins")
        .select("user_id")
        .eq("user_id", callerUser.id)
        .maybeSingle();

      if (superadminErr) {
        console.error("[send-push-notification] superadmin check failed:", superadminErr);
        return json(500, {
          error: "Superadmin check failed"
        });
      }

      callerAllowed = Boolean(superadminRow?.user_id);
    }

    if (!callerAllowed) {
      return json(403, {
        error: "Forbidden"
      });
    }

    console.info("[send-push-notification] authorized caller", {
      callerUserId: callerUser.id,
      clubId
    });

    if (fish === "Aal" && sizeNum != null && sizeNum >= 200) {
      console.info("[send-push-notification] skip push for Aal size", sizeNum);
      return json(200, {
        ok: true,
        recipients: 0,
        note: "Suspicious Aal size skipped"
      });
    }

    if (!excludeUserId && angler) {
      const { data: profExact } = await supabase
        .from("profiles")
        .select("id")
        .eq("club_id", clubId)
        .eq("name", angler)
        .maybeSingle();
      if (profExact?.id) {
        excludeUserId = profExact.id;
        console.log("[send-push-notification] matched exact profile ID:", excludeUserId);
      } else {
        const { data: profCi } = await supabase
          .from("profiles")
          .select("id")
          .eq("club_id", clubId)
          .ilike("name", angler)
          .maybeSingle();
        if (profCi?.id) {
          excludeUserId = profCi.id;
          console.log("[send-push-notification] matched ci profile ID:", excludeUserId);
        }
      }
    }

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("subscription_id, user_id, opted_in, revoked_at, angler_name")
      .eq("club_id", clubId)
      .eq("opted_in", true)
      .is("revoked_at", null);

    if (subsErr) {
      console.error("[send-push-notification] subscriptions query failed:", subsErr);
      throw subsErr;
    }

    const normalizedAngler = angler.toLocaleLowerCase();
    const recipients = (subs ?? [])
      .filter((s) => !excludeUserId || s.user_id !== excludeUserId)
      .filter((s) => {
        if (typeof s.angler_name !== "string") return true;
        const matchesName = s.angler_name.trim().toLocaleLowerCase() === normalizedAngler;
        if (matchesName) {
          console.info("[send-push-notification] skip own subscription by name:", s.subscription_id);
          return false;
        }
        return true;
      })
      .map((s) => s.subscription_id)
      .filter((id) => typeof id === "string")
      .filter((id) => {
        const isValid = UUID_REGEX.test(id);
        if (!isValid) {
          console.warn("[send-push-notification] skip invalid subscription_id:", id);
        }
        return isValid;
      });

    console.log("[send-push-notification] recipients count:", recipients.length);

    if (recipients.length === 0) {
      console.info("[send-push-notification] no recipients – sender filtered out?");
      return json(200, {
        ok: true,
        recipients: 0,
        note: "No recipients (sender excluded?)"
      });
    }

    const art = artikel(fish);
    const sizeStr = sizeNum ? `${sizeNum} cm` : "";
    const content = `${angler} hat ${art} ${fish}${sizeStr ? " von " + sizeStr : ""} gefangen!`;

    const onesignalPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_subscription_ids: recipients,
      headings: {
        de: "🎣 Neuer Fang!",
        en: "🎣 Neuer Fang!"
      },
      contents: {
        de: content,
        en: content
      },
      url: "https://app.asv-rotauge.de/catches",
      data: {
        type: "catch",
        angler,
        fish,
        size: sizeNum
      }
    };

    console.log("[send-push-notification] sending to OneSignal:", onesignalPayload);

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(onesignalPayload)
    });

    const txt = await res.text();
    if (!res.ok) {
      console.error("[send-push-notification] OneSignal failure:", res.status, txt);
      return json(500, {
        error: "OneSignal failure",
        response: txt
      });
    }

    console.log("[send-push-notification] OneSignal success:", txt);
    return json(200, {
      ok: true,
      recipients: recipients.length,
      onesignal: JSON.parse(txt)
    });
  } catch (error) {
    console.error("[send-push-notification] failure:", error);
    return json(500, {
      error: String(error)
    });
  }
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-edge-secret,authorization"
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cors()
    }
  });
}
