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
    // Validate the request — invoked by pg_cron (daily at 6am UTC) or admin
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Find all assets with next_service date within the next 7 days (including overdue)
    const { data: assets, error: assetsError } = await adminClient
      .from("assets")
      .select("id, organization_id, name, category, make, model, serial_number, next_service, assigned_to, status")
      .lte("next_service", in7Days)
      .is("deleted_at", null)
      .neq("status", "retired")
      .order("next_service", { ascending: true });

    if (assetsError) throw assetsError;

    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0, message: "No assets due for service" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group assets by organization
    const orgAssets = new Map<string, typeof assets>();
    for (const asset of assets) {
      const orgId = asset.organization_id;
      if (!orgAssets.has(orgId)) {
        orgAssets.set(orgId, []);
      }
      orgAssets.get(orgId)!.push(asset);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    let notificationsSent = 0;
    let emailsSent = 0;

    for (const [orgId, orgAssetList] of orgAssets) {
      // Get org details
      const { data: org } = await adminClient
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .single();

      // Get admin/owner members for email notifications
      const { data: admins } = await adminClient
        .from("organization_members")
        .select("user_id, role, profiles(id, email, full_name)")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", ["owner", "admin", "manager"]);

      // Create in-app notifications for each relevant user
      const adminUserIds = (admins || []).map((a) => a.user_id);

      // Also notify assigned technicians
      const assignedUserIds = orgAssetList
        .filter((a) => a.assigned_to)
        .map((a) => a.assigned_to as string);

      const notifyUserIds = [...new Set([...adminUserIds, ...assignedUserIds])];

      // Separate overdue vs upcoming
      const overdueAssets = orgAssetList.filter((a) => a.next_service && a.next_service < today);
      const upcomingAssets = orgAssetList.filter((a) => a.next_service && a.next_service >= today);

      for (const userId of notifyUserIds) {
        // Create a single combined notification per user
        const overdueCount = overdueAssets.length;
        const upcomingCount = upcomingAssets.length;
        const totalCount = overdueCount + upcomingCount;

        let title = "";
        if (overdueCount > 0 && upcomingCount > 0) {
          title = `${overdueCount} overdue + ${upcomingCount} upcoming asset service${totalCount > 1 ? "s" : ""}`;
        } else if (overdueCount > 0) {
          title = `${overdueCount} asset${overdueCount > 1 ? "s" : ""} overdue for service`;
        } else {
          title = `${upcomingCount} asset${upcomingCount > 1 ? "s" : ""} due for service this week`;
        }

        const assetNames = orgAssetList
          .slice(0, 5)
          .map((a) => `${a.name}${a.make ? ` (${a.make}${a.model ? " " + a.model : ""})` : ""}`)
          .join(", ");

        const body = assetNames + (orgAssetList.length > 5 ? ` and ${orgAssetList.length - 5} more` : "");

        await adminClient.from("notifications").insert({
          organization_id: orgId,
          user_id: userId,
          type: "system",
          title,
          body,
          related_entity_type: "asset",
          metadata: {
            asset_count: totalCount,
            overdue_count: overdueCount,
            upcoming_count: upcomingCount,
            asset_ids: orgAssetList.map((a) => a.id),
          },
        });

        notificationsSent++;
      }

      // Send email digest to admins
      if (resendApiKey && admins) {
        for (const admin of admins) {
          const profile = admin.profiles as { id: string; email: string; full_name: string } | null;
          if (!profile?.email) continue;

          const assetRows = orgAssetList
            .map((a) => {
              const isOverdue = a.next_service && a.next_service < today;
              const statusLabel = isOverdue ? "OVERDUE" : "Upcoming";
              const statusColor = isOverdue ? "#EF4444" : "#F59E0B";
              return `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 4px; font-size: 13px;">${a.name}</td>
                  <td style="padding: 8px 4px; font-size: 13px; color: #666;">${a.make || ""}${a.model ? " " + a.model : ""}</td>
                  <td style="padding: 8px 4px; font-size: 13px;">${a.next_service || "N/A"}</td>
                  <td style="padding: 8px 4px; font-size: 13px; font-weight: 600; color: ${statusColor};">${statusLabel}</td>
                </tr>
              `;
            })
            .join("");

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
                subject: `Asset Service Reminder: ${orgAssetList.length} asset${orgAssetList.length > 1 ? "s" : ""} need attention — ${org?.name || "Your org"}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                    <h2 style="color: #111; font-size: 20px; margin-bottom: 4px;">Asset Service Reminder</h2>
                    <p style="color: #888; font-size: 13px; margin-top: 0;">${org?.name || "Your organization"}</p>
                    <p style="color: #555; font-size: 14px;">The following assets are due or overdue for service:</p>

                    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                      <thead>
                        <tr style="border-bottom: 2px solid #ddd;">
                          <th style="padding: 8px 4px; text-align: left; font-size: 12px; color: #999; text-transform: uppercase;">Asset</th>
                          <th style="padding: 8px 4px; text-align: left; font-size: 12px; color: #999; text-transform: uppercase;">Make/Model</th>
                          <th style="padding: 8px 4px; text-align: left; font-size: 12px; color: #999; text-transform: uppercase;">Service Date</th>
                          <th style="padding: 8px 4px; text-align: left; font-size: 12px; color: #999; text-transform: uppercase;">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${assetRows}
                      </tbody>
                    </table>

                    <a href="${appUrl}/assets" style="display: inline-block; margin-top: 28px; padding: 12px 28px; background: #10B981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      View Assets
                    </a>

                    <p style="color: #999; font-size: 12px; margin-top: 32px;">
                      This is an automated reminder from iWorkr. Assets with upcoming or overdue service dates are flagged daily.
                    </p>
                  </div>
                `,
              }),
            });
            emailsSent++;
          } catch (emailErr) {
            console.error(`Failed to send asset reminder to ${profile.email}:`, emailErr);
          }
        }
      }
    }

    // Audit the cron run
    await adminClient.from("audit_log").insert({
      action: "cron.asset_service_reminder",
      entity_type: "system",
      new_data: {
        total_assets: assets.length,
        orgs_processed: orgAssets.size,
        notifications_sent: notificationsSent,
        emails_sent: emailsSent,
      },
    });

    console.log(
      `Asset service reminders: ${assets.length} assets, ${orgAssets.size} orgs, ${notificationsSent} notifications, ${emailsSent} emails`
    );

    return new Response(
      JSON.stringify({
        success: true,
        total_assets: assets.length,
        orgs_processed: orgAssets.size,
        notifications_sent: notificationsSent,
        emails_sent: emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Asset service reminder error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
