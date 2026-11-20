import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const encoder = new TextEncoder();
const hashCode = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value.trim().toUpperCase()));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const body = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `OMX-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12)}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Server configuration is incomplete" }, 500);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid or expired session" }, 401);

  const { data: isAdmin, error: adminError } = await authClient.rpc("omax_is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Administrator access required" }, 403);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "dashboard") {
      const [codes, subscriptions, users, redemptions] = await Promise.all([
        admin.from("omax_activation_codes").select("id", { count: "exact", head: true }),
        admin.from("omax_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").gt("expires_at", new Date().toISOString()),
        admin.from("omax_profiles").select("user_id", { count: "exact", head: true }),
        admin.from("omax_activation_codes").select("id", { count: "exact", head: true }).not("redeemed_at", "is", null),
      ]);
      const failure = [codes, subscriptions, users, redemptions].find((r) => r.error);
      if (failure?.error) throw failure.error;
      return json({
        totalCodes: codes.count ?? 0,
        activeSubscriptions: subscriptions.count ?? 0,
        registeredUsers: users.count ?? 0,
        redemptions: redemptions.count ?? 0,
      });
    }

    if (action === "list_codes") {
      const { data, error } = await admin.from("omax_activation_codes")
        .select("id, assigned_name, notes, duration_months, duration_days, is_lifetime, tier, is_active, redeemed_by, redeemed_at, created_at")
        .order("created_at", { ascending: false }).limit(250);
      if (error) throw error;
      const redeemerIds = [...new Set((data ?? []).map((row) => row.redeemed_by).filter((id): id is string => Boolean(id)))];
      const { data: redeemerProfiles, error: redeemerError } = redeemerIds.length
        ? await admin.from("omax_profiles").select("user_id, display_name").in("user_id", redeemerIds)
        : { data: [], error: null };
      if (redeemerError) throw redeemerError;
      return json({ codes: (data ?? []).map((row) => ({
        ...row,
        redeemed_by_name: redeemerProfiles?.find((profile) => profile.user_id === row.redeemed_by)?.display_name ?? null,
      })) });
    }

    if (action === "generate_codes") {
      const requestedCount = Number(body.count ?? 1);
      if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 100) {
        return json({ error: "Quantity must be a whole number between 1 and 100." }, 400);
      }
      const count = requestedCount;
      const isLifetime = body.isLifetime === true;
      const durationDays = isLifetime ? null : Number(body.durationDays ?? 30);
      if (body.tier !== undefined && !["standard", "premium"].includes(body.tier)) {
        return json({ error: "Tier must be standard or premium." }, 400);
      }
      const tier = body.tier === "premium" ? "premium" : "standard";
      if (!isLifetime && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365)) {
        return json({ error: "Duration must be a whole number between 1 and 365 days, or lifetime." }, 400);
      }
      const legacyMonths = isLifetime ? 12 : Math.max(1, Math.ceil(durationDays! / 30));
      const assignedName = typeof body.assignedName === "string" ? body.assignedName.trim().slice(0, 120) : null;
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;
      const customCodes = Array.isArray(body.customCodes) ? body.customCodes : [];
      if (customCodes.length && (count !== 1 || customCodes.length !== 1)) {
        return json({ error: "Custom code mode creates exactly one code per request." }, 400);
      }
      const plainCodes: string[] = [];
      for (let i = 0; i < count; i++) {
        const candidate = customCodes.length ? String(customCodes[i]).trim().toUpperCase() : randomCode();
        if (!/^[A-Z0-9-]{6,48}$/.test(candidate)) return json({ error: "Custom code must be 6–48 letters, numbers, or hyphens." }, 400);
        plainCodes.push(candidate);
      }
      if (new Set(plainCodes).size !== plainCodes.length) return json({ error: "Duplicate codes in batch." }, 400);
      const rows = await Promise.all(plainCodes.map(async (code) => ({
        code_hash: await hashCode(code),
        duration_months: legacyMonths,
        duration_days: durationDays,
        is_lifetime: isLifetime,
        tier,
        assigned_name: assignedName,
        notes,
        created_by: userData.user.id,
      })));
      const { data, error } = await admin.from("omax_activation_codes")
        .insert(rows).select("id, assigned_name, duration_months, duration_days, is_lifetime, tier, created_at");
      if (error) {
        if (error.code === "23505") return json({ error: "A code already exists. Generate a new one and retry." }, 409);
        throw error;
      }
      await admin.from("omax_audit_logs").insert(plainCodes.map((_, i) => ({
        actor_user_id: userData.user.id,
        action: "activation_code_created",
        metadata: { activation_code_id: data?.[i]?.id, tier, duration_days: durationDays, is_lifetime: isLifetime },
      })));
      return json({ codes: plainCodes, records: data ?? [], revealOnce: true }, 201);
    }

    if (action === "update_code") {
      const id = String(body.id ?? "");
      const updates: Record<string, unknown> = {};
      if (typeof body.assignedName === "string") updates.assigned_name = body.assignedName.trim().slice(0, 120) || null;
      if (typeof body.notes === "string") updates.notes = body.notes.trim().slice(0, 500) || null;
      if (body.isLifetime === true) {
        updates.is_lifetime = true;
        updates.duration_days = null;
        updates.duration_months = 12;
      } else if (body.isLifetime === false || body.durationDays !== undefined) {
        const days = Number(body.durationDays);
        if (!Number.isInteger(days) || days < 1 || days > 365) {
          return json({ error: "Duration must be a whole number between 1 and 365 days, or lifetime." }, 400);
        }
        updates.is_lifetime = false;
        updates.duration_days = days;
        updates.duration_months = Math.max(1, Math.ceil(days / 30));
      }
      if (["standard", "premium"].includes(body.tier)) updates.tier = body.tier;
      if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
      const { data, error } = await admin.from("omax_activation_codes").update(updates)
        .eq("id", id).is("redeemed_by", null)
        .select("id, assigned_name, notes, duration_months, duration_days, is_lifetime, tier, is_active").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Code not found or already redeemed." }, 404);
      await admin.from("omax_audit_logs").insert({
        actor_user_id: userData.user.id, action: "activation_code_updated",
        metadata: { activation_code_id: id, changed_fields: Object.keys(updates) },
      });
      return json({ code: data });
    }

    if (action === "list_subscriptions") {
      const { data, error } = await admin.from("omax_subscriptions")
        .select("id, user_id, activation_code_id, status, tier, starts_at, expires_at, is_lifetime, created_at")
        .order("created_at", { ascending: false }).limit(250);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((row) => row.user_id))];
      const { data: profiles, error: profileError } = ids.length
        ? await admin.from("omax_profiles").select("user_id, display_name").in("user_id", ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      return json({ subscriptions: (data ?? []).map((row) => ({
        ...row,
        display_name: profiles?.find((profile) => profile.user_id === row.user_id)?.display_name ?? null,
      })) });
    }

    if (action === "list_users") {
      const page = Math.max(1, Math.min(100, Number(body.page ?? 1)));
      const { data: authData, error: authListError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (authListError) throw authListError;
      const ids = authData.users.map((u) => u.id);
      const [profiles, subscriptions] = await Promise.all([
        ids.length ? admin.from("omax_profiles").select("user_id, display_name, created_at").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? admin.from("omax_subscriptions").select("user_id, status, tier, expires_at, is_lifetime").in("user_id", ids).order("expires_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ]);
      if (profiles.error) throw profiles.error;
      if (subscriptions.error) throw subscriptions.error;
      return json({ users: authData.users.map((u) => ({
        id: u.id, email: u.email, createdAt: u.created_at,
        profile: profiles.data?.find((p) => p.user_id === u.id) ?? null,
        subscription: subscriptions.data?.find((s) => s.user_id === u.id) ?? null,
      })) });
    }

    if (action === "list_audit") {
      const { data, error } = await admin.from("omax_audit_logs")
        .select("id, actor_user_id, target_user_id, action, metadata, created_at")
        .order("created_at", { ascending: false }).limit(250);
      if (error) throw error;
      return json({ logs: data ?? [] });
    }

    if (action === "revoke_subscription") {
      const id = String(body.id ?? "");
      const { data, error } = await admin.from("omax_subscriptions").update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", id).eq("status", "active").select("id, user_id, status").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Active subscription not found." }, 404);
      await admin.from("omax_audit_logs").insert({
        actor_user_id: userData.user.id, target_user_id: data.user_id,
        action: "subscription_revoked", metadata: { subscription_id: id },
      });
      return json({ subscription: data });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Omax admin API error:", error);
    return json({ error: "The requested operation failed." }, 500);
  }
});
