import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();
const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
const OPS_ALERT_SECRET = (Deno.env.get("OPS_ALERT_SECRET") ?? "").trim();
const OPS_ALERT_WEBHOOK_URL = (Deno.env.get("OPS_ALERT_WEBHOOK_URL") ?? "").trim();
const ONESIGNAL_APP_ID = (Deno.env.get("ONESIGNAL_APP_ID") ?? "").trim();
const ONESIGNAL_API_KEY = (Deno.env.get("ONESIGNAL_API_KEY") ?? "").trim();
const OPS_ALERT_MIN_SEVERITY = (Deno.env.get("OPS_ALERT_MIN_SEVERITY") ?? "error").trim().toLowerCase();
const OPS_ALERT_WEB_URL = (Deno.env.get("OPS_ALERT_WEB_URL") ?? "https://app.asv-rotauge.de").trim();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const severityOrder: Record<string, number> = {
  info: 10,
  warning: 20,
  error: 30,
  critical: 40,
};
const minSeverityRank = severityOrder[OPS_ALERT_MIN_SEVERITY] ?? severityOrder.error;

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null;

type AlertSeverity = "info" | "warning" | "error" | "critical";

type AlertPayload = {
  source?: string;
  service?: string;
  severity?: string;
  message?: string;
  release?: string | null;
  context?: unknown;
};

type AlertAuthResult = {
  kind: "trusted-secret" | "user";
  userId: string | null;
};

type PersistableAlertPayload = {
  source: string;
  service: string;
  severity: AlertSeverity;
  message: string;
  release: string | null;
  context: Record<string, unknown>;
  request_id: string;
  actor_user_id: string | null;
  created_at: string;
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-ops-secret",
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cors(),
    },
  });
}

function truncate(value: string, max = 900): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function normalizeSeverity(raw: unknown): AlertSeverity {
  const value = String(raw ?? "error").trim().toLowerCase();
  if (value === "info" || value === "warning" || value === "critical") {
    return value;
  }
  return "error";
}

function severityAllowsNotification(severity: AlertSeverity): boolean {
  return (severityOrder[severity] ?? severityOrder.error) >= minSeverityRank;
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function compactContext(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = Object.entries(raw).slice(0, 20);
  const compact: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value == null) continue;
    if (typeof value === "string") {
      compact[key] = truncate(value, 300);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      compact[key] = value;
      continue;
    }
    compact[key] = truncate(JSON.stringify(value), 300);
  }
  return compact;
}

async function authenticateCall(req: Request): Promise<AlertAuthResult | null> {
  const bearerToken = readBearerToken(req);

  if (OPS_ALERT_SECRET) {
    const provided = (req.headers.get("x-ops-secret") ?? "").trim();
    if (provided && provided === OPS_ALERT_SECRET) {
      return { kind: "trusted-secret", userId: null };
    }
  }

  if (SERVICE_KEY && bearerToken && bearerToken === SERVICE_KEY) {
    return { kind: "trusted-secret", userId: null };
  }

  if (!bearerToken || !supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(bearerToken);
  if (error || !user?.id) return null;
  return { kind: "user", userId: user.id };
}

async function collectAdminRecipients(): Promise<{ recipientIds: string[]; adminUsers: number }> {
  if (!supabase) return { recipientIds: [], adminUsers: 0 };

  const userIds = new Set<string>();
  const { data: admins } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("is_active", true)
    .eq("role", "admin");

  for (const row of admins ?? []) {
    const userId = typeof row?.user_id === "string" ? row.user_id : "";
    if (UUID_REGEX.test(userId)) userIds.add(userId);
  }

  if (userIds.size === 0) return { recipientIds: [], adminUsers: 0 };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription_id,user_id")
    .eq("opted_in", true)
    .is("revoked_at", null)
    .in("user_id", Array.from(userIds));

  const recipientIds = Array.from(
    new Set(
      (subs ?? [])
        .map((row) => row?.subscription_id)
        .filter((value): value is string => typeof value === "string" && UUID_REGEX.test(value)),
    ),
  );
  return {
    recipientIds,
    adminUsers: userIds.size,
  };
}

async function sendWebhook(payload: Record<string, unknown>): Promise<{ sent: boolean; status: number | null; error?: string }> {
  if (!OPS_ALERT_WEBHOOK_URL) return { sent: false, status: null };

  const text = [
    `Angelwetter Alert [${payload.severity}]`,
    `${payload.service || payload.source}: ${payload.message}`,
    payload.release ? `Release: ${payload.release}` : null,
    payload.request_id ? `Request: ${payload.request_id}` : null,
  ].filter(Boolean).join("\n");

  const body = OPS_ALERT_WEBHOOK_URL.includes("hooks.slack.com")
    ? { text }
    : { text, payload };

  try {
    const response = await fetch(OPS_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { sent: false, status: response.status, error: `Webhook ${response.status}` };
    }
    return { sent: true, status: response.status };
  } catch (error) {
    return { sent: false, status: null, error: String(error) };
  }
}

async function sendOneSignalAlert(
  payload: Record<string, unknown>,
): Promise<{ sent: boolean; recipients: number; admin_users: number; error?: string }> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    return { sent: false, recipients: 0, admin_users: 0, error: "OneSignal env missing" };
  }

  const { recipientIds: recipients, adminUsers } = await collectAdminRecipients();
  if (recipients.length === 0) {
    return { sent: false, recipients: 0, admin_users: adminUsers, error: "No admin push recipients" };
  }

  const severity = String(payload.severity ?? "error").toUpperCase();
  const service = truncate(String(payload.service ?? payload.source ?? "app"), 64);
  const message = truncate(String(payload.message ?? "Unknown alert"), 120);
  const content = `${service}: ${message}`;

  const onesignalPayload = {
    app_id: ONESIGNAL_APP_ID,
    include_subscription_ids: recipients,
    headings: { de: `🚨 ${severity}`, en: `🚨 ${severity}` },
    contents: { de: content, en: content },
    url: OPS_ALERT_WEB_URL,
    data: {
      type: "ops_alert",
      severity: payload.severity,
      source: payload.source,
      service,
      request_id: payload.request_id ?? null,
    },
  };

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(onesignalPayload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        sent: false,
        recipients: recipients.length,
        admin_users: adminUsers,
        error: `OneSignal ${response.status}: ${text.slice(0, 180)}`,
      };
    }
    return { sent: true, recipients: recipients.length, admin_users: adminUsers };
  } catch (error) {
    return { sent: false, recipients: recipients.length, admin_users: adminUsers, error: String(error) };
  }
}

async function persistAlertEvent({
  payload,
  authKind,
  notified,
  channels,
  notificationReason = null,
}: {
  payload: PersistableAlertPayload;
  authKind: AlertAuthResult["kind"];
  notified: boolean;
  channels: Record<string, unknown>;
  notificationReason?: string | null;
}) {
  if (!supabase) return;

  const { error } = await supabase
    .from("ops_alert_events")
    .insert({
      request_id: payload.request_id,
      created_at: payload.created_at,
      source: payload.source,
      service: payload.service,
      severity: payload.severity,
      message: payload.message,
      release: payload.release,
      context: payload.context,
      actor_user_id: payload.actor_user_id,
      auth_kind: authKind,
      notified,
      notification_reason: notificationReason,
      channels,
    });
  if (error) {
    console.error("[opsAlert] failed to persist alert event:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const auth = await authenticateCall(req);
  if (!auth) {
    return json(401, { error: "Unauthorized" });
  }

  const body = await req.json().catch(() => ({})) as AlertPayload;
  const severity = normalizeSeverity(body?.severity);
  const message = truncate(String(body?.message ?? "").trim(), 220);
  if (!message) return json(400, { error: "Missing message" });

  const requestId = crypto.randomUUID();
  const source = truncate(String(body?.source ?? "unknown"), 32);
  const service = truncate(String(body?.service ?? source), 64);
  const context = compactContext(body?.context);
  const payload: PersistableAlertPayload = {
    source,
    service,
    severity,
    message,
    release: body?.release ? truncate(String(body.release), 80) : null,
    context,
    request_id: requestId,
    actor_user_id: auth.userId,
    created_at: new Date().toISOString(),
  };

  const consoleMethod = severityOrder[severity] >= severityOrder.error ? "error" : "log";
  console[consoleMethod]("[opsAlert]", payload);

  if (!severityAllowsNotification(severity)) {
    await persistAlertEvent({
      payload,
      authKind: auth.kind,
      notified: false,
      notificationReason: "below_min_severity",
      channels: {},
    });
    return json(202, {
      ok: true,
      notified: false,
      reason: "below_min_severity",
      request_id: requestId,
    });
  }

  const [webhook, oneSignal] = await Promise.all([
    sendWebhook(payload),
    sendOneSignalAlert(payload),
  ]);

  const channels = {
    webhook,
    one_signal: oneSignal,
  };
  const notified = webhook.sent || oneSignal.sent;
  await persistAlertEvent({
    payload,
    authKind: auth.kind,
    notified,
    channels,
  });

  return json(notified ? 200 : 202, {
    ok: true,
    notified,
    request_id: requestId,
    channels,
  });
});
