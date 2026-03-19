import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GoHighLevel V2 Webhook endpoint.
 *
 * Receives ContactCreate, ContactUpdate, OpportunityStatusUpdate events.
 * Maps GHL contacts to iWorkr clients via the ghl_location_mappings table.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const eventType = payload.type ?? payload.event;
    const locationId = payload.locationId ?? payload.location_id;

    if (!eventType || !locationId) {
      return NextResponse.json({ error: "Missing event type or location" }, { status: 400 });
    }

    // Look up the iWorkr organization mapped to this GHL location
    const { data: mapping } = await supabaseAdmin
      .from("ghl_location_mappings")
      .select("organization_id, integration_id")
      .eq("ghl_location_id", locationId)
      .maybeSingle();

    if (!mapping) {
      return NextResponse.json({ error: "Unknown GHL location" }, { status: 404 });
    }

    const orgId = mapping.organization_id;

    switch (eventType) {
      case "ContactCreate":
      case "ContactUpdate": {
        const contact = payload.contact ?? payload;
        const ghlContactId = contact.id ?? contact.contactId;
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "GHL Lead";
        const email = contact.email ?? null;
        const phone = contact.phone ?? null;

        // Upsert into clients table, using external_id to prevent duplicates
        const { error } = await supabaseAdmin
          .from("clients")
          .upsert(
            {
              organization_id: orgId,
              external_id: `ghl:${ghlContactId}`,
              name,
              email,
              phone,
              source: "gohighlevel",
              status: "lead",
              notes: `Imported from GoHighLevel (${eventType})`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,external_id" }
          );

        if (error) {
          console.error("GHL ContactCreate upsert error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fire a notification for new leads
        if (eventType === "ContactCreate") {
          await supabaseAdmin.from("notifications").insert({
            organization_id: orgId,
            type: "integration",
            title: `New Lead from GoHighLevel: ${name}`,
            body: `${email ?? phone ?? "No contact info"} — auto-imported to CRM`,
            channel: "in_app",
            status: "unread",
          });
        }

        // Log sync event
        await supabaseAdmin.from("integration_sync_log").insert({
          integration_id: mapping.integration_id,
          organization_id: orgId,
          direction: "pull",
          entity_type: "client",
          provider_entity_id: ghlContactId,
          status: "success",
          metadata: { event: eventType, source: "webhook" },
        });

        return NextResponse.json({ ok: true, event: eventType, contact: ghlContactId });
      }

      case "OpportunityStatusUpdate": {
        const opp = payload.opportunity ?? payload;
        const contactId = opp.contactId ?? opp.contact_id;
        const status = opp.status ?? opp.pipelineStageId;

        // Update client status based on opportunity pipeline
        if (contactId && status) {
          const clientStatus = status === "won" ? "active" : status === "lost" ? "inactive" : "lead";
          await supabaseAdmin
            .from("clients")
            .update({ status: clientStatus, updated_at: new Date().toISOString() })
            .eq("organization_id", orgId)
            .eq("external_id", `ghl:${contactId}`);
        }

        return NextResponse.json({ ok: true, event: eventType });
      }

      default:
        return NextResponse.json({ ok: true, skipped: eventType });
    }
  } catch (err) {
    console.error("GHL webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
