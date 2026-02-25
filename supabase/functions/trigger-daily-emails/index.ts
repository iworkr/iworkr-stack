import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate the request — this function is invoked by pg_cron or an admin
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Allow calls from pg_cron (service_role bearer) or verify admin caller
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader! } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use service_role to bypass RLS for cross-org digest queries
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    // Fetch all active organizations
    const { data: orgs, error: orgsError } = await adminClient
      .from("organizations")
      .select("id, name, slug, settings");

    if (orgsError) throw orgsError;

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    let emailsEnqueued = 0;
    let orgsProcessed = 0;

    for (const org of orgs || []) {
      // Get admin/owner members who should receive the digest
      const { data: admins } = await adminClient
        .from("organization_members")
        .select("user_id, role, profiles(id, email, full_name)")
        .eq("organization_id", org.id)
        .eq("status", "active")
        .in("role", ["owner", "admin"]);

      if (!admins || admins.length === 0) continue;

      // Gather daily summary data for this org

      // Jobs created or completed in last 24h
      const { data: newJobs, count: newJobCount } = await adminClient
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .gte("created_at", yesterday)
        .is("deleted_at", null);

      const { data: completedJobs, count: completedJobCount } = await adminClient
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("status", "done")
        .gte("updated_at", yesterday)
        .is("deleted_at", null);

      // Overdue invoices
      const { count: overdueInvoiceCount } = await adminClient
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("status", "sent")
        .lt("due_date", now.toISOString().split("T")[0])
        .is("deleted_at", null);

      // Schedule blocks for today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const { count: todayScheduleCount } = await adminClient
        .from("schedule_blocks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .gte("start_time", todayStart)
        .lt("start_time", todayEnd);

      // Assets needing service in next 7 days
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { count: upcomingServiceCount } = await adminClient
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .lte("next_service", nextWeek)
        .gte("next_service", now.toISOString().split("T")[0])
        .is("deleted_at", null);

      // Skip if nothing to report
      if (
        (newJobCount || 0) === 0 &&
        (completedJobCount || 0) === 0 &&
        (overdueInvoiceCount || 0) === 0 &&
        (todayScheduleCount || 0) === 0 &&
        (upcomingServiceCount || 0) === 0
      ) {
        continue;
      }

      // Enqueue digest email for each admin via mail_queue
      for (const admin of admins) {
        const profile = admin.profiles as { id: string; email: string; full_name: string } | null;
        if (!profile?.email) continue;

        try {
          await adminClient.from("mail_queue").insert({
            organization_id: org.id,
            event_type: "daily_fleet_digest",
            recipient_email: profile.email,
            payload: {
              workspace: { name: org.name },
              date: now.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
              stats: {
                new_jobs: newJobCount || 0,
                completed_jobs: completedJobCount || 0,
                overdue_invoices: overdueInvoiceCount || 0,
                today_schedule: todayScheduleCount || 0,
                upcoming_service: upcomingServiceCount || 0,
              },
              tech: { name: profile.full_name || "Admin" },
            },
          });
          emailsEnqueued++;
        } catch (enqueueErr) {
          console.error(`Failed to enqueue digest for ${profile.email}:`, enqueueErr);
        }
      }

      orgsProcessed++;
    }

    // Audit log for the cron run
    await adminClient.from("audit_log").insert({
      action: "cron.daily_digest",
      entity_type: "system",
      new_data: { orgs_processed: orgsProcessed, emails_enqueued: emailsEnqueued },
    });

    console.log(`Daily digest complete: ${orgsProcessed} orgs, ${emailsEnqueued} emails enqueued`);

    return new Response(
      JSON.stringify({
        success: true,
        orgs_processed: orgsProcessed,
        emails_enqueued: emailsEnqueued,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Daily digest error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
