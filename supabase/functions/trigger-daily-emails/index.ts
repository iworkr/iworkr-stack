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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    let emailsSent = 0;
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

      // Send digest email to each admin
      for (const admin of admins) {
        const profile = admin.profiles as { id: string; email: string; full_name: string } | null;
        if (!profile?.email) continue;

        if (resendApiKey) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: Deno.env.get("RESEND_FROM_EMAIL") || "iWorkr <noreply@iworkrapp.com>",
                to: [profile.email],
                subject: `Daily Digest for ${org.name} — ${now.toLocaleDateString("en-AU")}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
                    <h2 style="color: #111; font-size: 20px; margin-bottom: 4px;">Daily Digest</h2>
                    <p style="color: #888; font-size: 13px; margin-top: 0;">${org.name} &mdash; ${now.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px;">
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px 0; color: #555;">New jobs</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600;">${newJobCount || 0}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px 0; color: #555;">Completed jobs</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600;">${completedJobCount || 0}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px 0; color: #555;">Overdue invoices</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600; ${(overdueInvoiceCount || 0) > 0 ? "color: #EF4444;" : ""}">${overdueInvoiceCount || 0}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px 0; color: #555;">Today's schedule</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600;">${todayScheduleCount || 0} blocks</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #555;">Assets due for service (7d)</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600; ${(upcomingServiceCount || 0) > 0 ? "color: #F59E0B;" : ""}">${upcomingServiceCount || 0}</td>
                      </tr>
                    </table>

                    <a href="${appUrl}/dashboard" style="display: inline-block; margin-top: 28px; padding: 12px 28px; background: #10B981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Open Dashboard
                    </a>

                    <p style="color: #999; font-size: 12px; margin-top: 32px;">
                      This is an automated daily digest from iWorkr. You receive this because you are an admin of ${org.name}.
                    </p>
                  </div>
                `,
              }),
            });
            emailsSent++;
          } catch (emailErr) {
            console.error(`Failed to send digest to ${profile.email}:`, emailErr);
          }
        }
      }

      orgsProcessed++;
    }

    // Audit log for the cron run
    await adminClient.from("audit_log").insert({
      action: "cron.daily_digest",
      entity_type: "system",
      new_data: { orgs_processed: orgsProcessed, emails_sent: emailsSent },
    });

    console.log(`Daily digest complete: ${orgsProcessed} orgs, ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({
        success: true,
        orgs_processed: orgsProcessed,
        emails_sent: emailsSent,
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
