import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OrgMember = {
  user_id: string;
  role: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const {
      data: { user },
    } = await anon.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { policy_version_id } = await req.json();
    if (!policy_version_id) {
      return new Response(JSON.stringify({ error: "policy_version_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: version, error: verErr } = await admin
      .from("policy_versions")
      .select("id, policy_id, organization_id, version_number, policy_register(title, target_audience_rules, enforcement_level, grace_period_days)")
      .eq("id", policy_version_id)
      .single();
    if (verErr || !version) throw new Error(verErr?.message || "Policy version not found");

    const policy = version.policy_register as {
      title: string;
      target_audience_rules?: { audience?: string; roles?: string[] };
      enforcement_level: number;
      grace_period_days?: number;
    };
    const rules = policy.target_audience_rules || { audience: "all" };
    const grace = Number(policy.grace_period_days || 7);

    const { data: actor } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", version.organization_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!actor || !["owner", "admin", "manager", "office_admin"].includes(actor.role)) {
      return new Response(JSON.stringify({ error: "Insufficient privileges" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: members, error: membersErr } = await admin
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", version.organization_id)
      .eq("status", "active");
    if (membersErr) throw new Error(membersErr.message);

    let targets = (members || []) as OrgMember[];
    if (Array.isArray(rules.roles) && rules.roles.length > 0) {
      const allowed = new Set(rules.roles);
      targets = targets.filter((m) => allowed.has(m.role));
    }

    const targetIds = targets.map((m) => m.user_id);
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ success: true, inserted: 0, expired: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: leaveRows } = await admin
      .from("staff_leave")
      .select("user_id, end_date")
      .eq("organization_id", version.organization_id)
      .eq("status", "approved")
      .lte("start_date", new Date().toISOString().slice(0, 10))
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .in("user_id", targetIds);
    const onLeave = new Map<string, string>();
    for (const row of leaveRows || []) {
      onLeave.set(row.user_id, row.end_date);
    }

    const { error: expireErr } = await admin
      .from("policy_acknowledgements")
      .update({ status: "expired" })
      .eq("organization_id", version.organization_id)
      .eq("policy_id", version.policy_id)
      .eq("status", "pending")
      .in("user_id", targetIds);
    if (expireErr) throw new Error(expireErr.message);

    const now = new Date();
    const dueAt = new Date(now.getTime() + grace * 24 * 60 * 60 * 1000).toISOString();
    const ackRows = targetIds.map((workerId) => {
      const leaveEnd = onLeave.get(workerId);
      const suspended = Boolean(leaveEnd);
      return {
        organization_id: version.organization_id,
        policy_id: version.policy_id,
        user_id: workerId,
        policy_version_id: version.id,
        policy_version: version.version_number,
        status: "pending",
        due_at: dueAt,
        countdown_suspended: suspended,
        countdown_resume_at: suspended ? new Date(`${leaveEnd}T23:59:59.000Z`).toISOString() : null,
      };
    });

    const { data: inserted, error: insErr } = await admin
      .from("policy_acknowledgements")
      .upsert(ackRows, { onConflict: "user_id,policy_version_id" })
      .select("id");
    if (insErr) throw new Error(insErr.message);

    try {
      await admin.functions.invoke("send-push", {
        body: {
          organization_id: version.organization_id,
          user_ids: targetIds,
          title: "Mandatory policy update",
          body: `${policy.title} (${version.version_number}) requires acknowledgement.`,
          data: {
            type: "policy_ack_required",
            policy_id: version.policy_id,
            policy_version_id: version.id,
            enforcement_level: policy.enforcement_level,
          },
        },
      });
    } catch {
      // Do not fail distribution if push provider is unavailable.
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: inserted?.length || 0,
        total_targets: targetIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

