"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cancelShiftWithNDISLogic } from "@/app/actions/roster-templates";

const SHORT_NOTICE_HOURS = 7 * 24;

type PortalRelationship =
  | "primary_guardian"
  | "secondary_guardian"
  | "self"
  | "external_coordinator";

type LinkedParticipantAccess = {
  participant_id: string;
  relationship_type: PortalRelationship;
  permissions: Record<string, unknown>;
  organization_id: string;
  participant_name: string;
  share_observations_with_family: boolean;
};

async function getAuthedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function getLinkedParticipants(userId: string): Promise<LinkedParticipantAccess[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase as any)
    .from("participant_network_members")
    .select(`
      participant_id,
      relationship_type,
      permissions,
      participant_profiles!inner(
        id,
        organization_id,
        preferred_name,
        share_observations_with_family,
        clients!inner(name)
      )
    `)
    .eq("user_id", userId);

  return (data || []).map((row: any): LinkedParticipantAccess => ({
    participant_id: row.participant_id as string,
    relationship_type: row.relationship_type as PortalRelationship,
    permissions: (row.permissions || {}) as Record<string, unknown>,
    organization_id: row.participant_profiles.organization_id as string,
    participant_name:
      (row.participant_profiles.preferred_name as string | null) ||
      (row.participant_profiles.clients?.name as string) ||
      "Participant",
    share_observations_with_family:
      !!row.participant_profiles.share_observations_with_family,
  }));
}

function safeFirstName(fullName: string | null | undefined) {
  if (!fullName) return "Support Worker";
  return fullName.split(" ").filter(Boolean)[0] || fullName;
}

export async function getPortalDashboard(participantId?: string) {
  const { supabase, user } = await getAuthedUser();
  const linked = await getLinkedParticipants(user.id);
  if (linked.length === 0) return { error: "No linked participants" };

  const active = participantId
    ? linked.find((p: LinkedParticipantAccess) => p.participant_id === participantId) || linked[0]
    : linked[0];

  const nowIso = new Date().toISOString();

  const { data: activeShift } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, start_time, end_time, title, status, technician_id")
    .eq("participant_id", active.participant_id)
    .in("status", ["in_progress", "on_site"])
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: nextShift } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, start_time, end_time, title, status, technician_id")
    .eq("participant_id", active.participant_id)
    .in("status", ["scheduled", "en_route", "on_site", "in_progress"])
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  const displayShift = activeShift || nextShift;

  let worker: {
    first_name: string;
    avatar_url: string | null;
    verified_badge: boolean;
  } | null = null;

  if (displayShift?.technician_id) {
    const { data: tech } = await (supabase as any)
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", displayShift.technician_id)
      .maybeSingle();

    const { count: verifiedCount } = await (supabase as any)
      .from("worker_credentials")
      .select("id", { count: "exact", head: true })
      .eq("user_id", displayShift.technician_id)
      .eq("status", "verified")
      .in("credential_type", ["NDIS_SCREENING", "WWCC"]);

    worker = {
      first_name: safeFirstName(tech?.full_name),
      avatar_url: tech?.avatar_url || null,
      verified_badge: (verifiedCount || 0) >= 2,
    };
  }

  const { data: agreement } = await (supabase as any)
    .from("service_agreements")
    .select("id, total_budget, consumed_budget, quarantined_budget, start_date, end_date, status")
    .eq("participant_id", active.participant_id)
    .in("status", ["active", "pending_signature"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const total = Number(agreement?.total_budget || 0);
  const consumed = Number(agreement?.consumed_budget || 0);
  const quarantined = Number(agreement?.quarantined_budget || 0);
  const remaining = Math.max(total - consumed - quarantined, 0);

  let safeBurnText = "No active budget telemetry yet.";
  if (agreement?.start_date && agreement?.end_date && total > 0) {
    const start = new Date(agreement.start_date);
    const end = new Date(agreement.end_date);
    const elapsedPct = Math.max(
      0,
      Math.min(
        100,
        ((Date.now() - start.getTime()) / (end.getTime() - start.getTime())) * 100
      )
    );
    const usedPct = (consumed / total) * 100;
    const delta = usedPct - elapsedPct;
    if (Math.abs(delta) <= 5) {
      safeBurnText = `You are ${Math.round(elapsedPct)}% through the plan and have used ${Math.round(usedPct)}% of your budget. You are on track.`;
    } else if (delta > 5) {
      safeBurnText = `You are ${Math.round(elapsedPct)}% through the plan and have used ${Math.round(usedPct)}% of your budget. Spend is running above trend.`;
    } else {
      safeBurnText = `You are ${Math.round(elapsedPct)}% through the plan and have used ${Math.round(usedPct)}% of your budget. Spend is below trend.`;
    }
  }

  let messages: any[] = [];
  let unreadCount = 0;
  const { data: externalChannel } = await (supabase as any)
    .from("care_chat_channels")
    .select("id")
    .eq("participant_id", active.participant_id)
    .eq("channel_type", "house_external")
    .maybeSingle();

  if (externalChannel?.id) {
    const { data: membership } = await (supabase as any)
      .from("care_chat_members")
      .select("last_read_at")
      .eq("channel_id", externalChannel.id)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: latest } = await (supabase as any)
      .from("care_chat_messages")
      .select("id, content, sender_id, created_at, is_deleted")
      .eq("channel_id", externalChannel.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(8);

    messages = latest || [];

    if (membership?.last_read_at) {
      const { count } = await (supabase as any)
        .from("care_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", externalChannel.id)
        .eq("is_deleted", false)
        .gt("created_at", membership.last_read_at);
      unreadCount = count || 0;
    }
  }

  return {
    linked_participants: linked,
    active_participant_id: active.participant_id,
    active_participant_name: active.participant_name,
    next_shift: displayShift
      ? {
          id: displayShift.id,
          start_time: displayShift.start_time,
          end_time: displayShift.end_time,
          title: displayShift.title || "Support Shift",
          status: displayShift.status,
          is_active: !!activeShift,
          worker,
        }
      : null,
    budget: { total, consumed, quarantined, remaining, safe_burn_text: safeBurnText },
    communications: {
      unread_count: unreadCount,
      latest: messages,
    },
  };
}

export async function getPortalRoster(participantId?: string) {
  const { supabase, user } = await getAuthedUser();
  const linked = await getLinkedParticipants(user.id);
  if (linked.length === 0) return { error: "No linked participants" };

  const active = participantId
    ? linked.find((p: LinkedParticipantAccess) => p.participant_id === participantId) || linked[0]
    : linked[0];

  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 28);

  const { data: shifts } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, start_time, end_time, title, status, technician_id")
    .eq("participant_id", active.participant_id)
    .gte("start_time", now.toISOString())
    .lte("start_time", maxDate.toISOString())
    .in("status", ["scheduled", "en_route", "on_site", "in_progress", "complete"])
    .order("start_time", { ascending: true });

  const techIds = Array.from(
    new Set((shifts || []).map((s: any) => s.technician_id).filter(Boolean))
  );
  let techMap: Record<string, { first_name: string; avatar_url: string | null }> = {};
  if (techIds.length > 0) {
    const { data: techs } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", techIds);
    techMap = Object.fromEntries(
      (techs || []).map((t: any) => [
        t.id,
        { first_name: safeFirstName(t.full_name), avatar_url: t.avatar_url || null },
      ])
    );
  }

  return {
    linked_participants: linked,
    active_participant_id: active.participant_id,
    roster: (shifts || []).map((s: any) => ({
      ...s,
      is_short_notice:
        (new Date(s.start_time).getTime() - Date.now()) / (1000 * 60 * 60) <
        SHORT_NOTICE_HOURS,
      worker: s.technician_id
        ? techMap[s.technician_id] || null
        : { first_name: "Pending Worker Match", avatar_url: null },
    })),
  };
}

export async function requestPortalShiftCancellation(input: {
  schedule_block_id: string;
  reason: string;
  acknowledge_short_notice: boolean;
}) {
  const { supabase, user } = await getAuthedUser();
  const { data: block } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, organization_id, participant_id, start_time, status")
    .eq("id", input.schedule_block_id)
    .maybeSingle();

  if (!block?.participant_id || !block?.organization_id) {
    return { success: false, error: "Shift not found." };
  }

  const { data: link } = await (supabase as any)
    .from("participant_network_members")
    .select("permissions")
    .eq("participant_id", block.participant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!link) return { success: false, error: "You do not have access to this participant." };
  const canCancel = link.permissions?.can_cancel_shifts !== false;
  if (!canCancel) return { success: false, error: "Shift cancellation is disabled for your profile." };

  const hoursUntilShift =
    (new Date(block.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
  const isShortNotice = hoursUntilShift < SHORT_NOTICE_HOURS;

  if (isShortNotice && !input.acknowledge_short_notice) {
    return {
      success: false,
      requires_acknowledgement: true,
      error: "Short notice cancellation acknowledgement required.",
    };
  }

  const reqHeaders = await headers();
  const forwarded = reqHeaders.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || null;
  const ua = reqHeaders.get("user-agent");

  await (supabase as any).from("portal_shift_cancellations").insert({
    organization_id: block.organization_id,
    participant_id: block.participant_id,
    schedule_block_id: block.id,
    requested_by_user_id: user.id,
    is_short_notice: isShortNotice,
    warning_acknowledged: isShortNotice ? input.acknowledge_short_notice : true,
    reason: input.reason || null,
    request_ip: ip,
    request_user_agent: ua,
  });

  const cancellation = await cancelShiftWithNDISLogic(
    block.id,
    block.organization_id,
    input.reason,
    isShortNotice
  );

  return cancellation;
}

export async function getPortalCareTeam(participantId?: string) {
  const { supabase, user } = await getAuthedUser();
  const linked = await getLinkedParticipants(user.id);
  if (linked.length === 0) return { error: "No linked participants" };
  const active = participantId
    ? linked.find((p: LinkedParticipantAccess) => p.participant_id === participantId) || linked[0]
    : linked[0];

  const { data: channel } = await (supabase as any)
    .from("care_chat_channels")
    .select("id, name")
    .eq("participant_id", active.participant_id)
    .eq("channel_type", "house_external")
    .maybeSingle();

  let messages: any[] = [];
  if (channel?.id) {
    const { data } = await (supabase as any)
      .from("care_chat_messages")
      .select("id, sender_id, content, message_type, created_at, is_deleted")
      .eq("channel_id", channel.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(40);
    messages = data || [];
  }

  const { data: familyNotes } = await (supabase as any)
    .from("family_progress_notes")
    .select("id, narrative, worker_id, created_at")
    .eq("participant_id", active.participant_id)
    .order("created_at", { ascending: false })
    .limit(30);

  let observations: any[] = [];
  if (active.share_observations_with_family) {
    const { data } = await (supabase as any)
      .from("health_observations")
      .select("id, observation_type, value_numeric, value_text, value_systolic, value_diastolic, unit, observed_at")
      .eq("participant_id", active.participant_id)
      .order("observed_at", { ascending: false })
      .limit(60);
    observations = data || [];
  }

  return {
    linked_participants: linked,
    active_participant_id: active.participant_id,
    channel_id: channel?.id || null,
    messages,
    family_notes: familyNotes || [],
    observations,
  };
}

export async function getPortalDocuments(participantId?: string) {
  const { supabase, user } = await getAuthedUser();
  const linked = await getLinkedParticipants(user.id);
  if (linked.length === 0) return { error: "No linked participants" };
  const active = participantId
    ? linked.find((p: LinkedParticipantAccess) => p.participant_id === participantId) || linked[0]
    : linked[0];

  const { data: docs } = await (supabase as any)
    .from("participant_documents")
    .select("id, title, file_path, status, requires_signature, signed_at, signed_by_user_id, created_at")
    .eq("participant_id", active.participant_id)
    .eq("is_visible_to_family", true)
    .order("created_at", { ascending: false });

  return {
    linked_participants: linked,
    active_participant_id: active.participant_id,
    documents: docs || [],
  };
}

export async function getPortalFunds(participantId?: string) {
  const { supabase, user } = await getAuthedUser();
  const linked = await getLinkedParticipants(user.id);
  if (linked.length === 0) return { error: "No linked participants" };
  const active = participantId
    ? linked.find((p: LinkedParticipantAccess) => p.participant_id === participantId) || linked[0]
    : linked[0];

  const { data: wallets } = await (supabase as any)
    .from("participant_wallets")
    .select("id, name, wallet_type, card_last_four, current_balance, updated_at")
    .eq("participant_id", active.participant_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);

  const walletIds = (wallets || []).map((w: any) => w.id as string);
  let ledger: any[] = [];
  if (walletIds.length > 0) {
    const { data } = await (supabase as any)
      .from("wallet_ledger_entries")
      .select("id, wallet_id, entry_type, amount, running_balance, category, description, receipt_image_url, created_at")
      .in("wallet_id", walletIds)
      .order("created_at", { ascending: false })
      .limit(200);
    ledger = data || [];
  }

  return {
    linked_participants: linked,
    active_participant_id: active.participant_id,
    wallets: wallets || [],
    ledger,
  };
}

export async function signPortalDocument(input: {
  document_id: string;
  signature_base64: string;
}) {
  const { supabase, user } = await getAuthedUser();

  const { data: doc } = await (supabase as any)
    .from("participant_documents")
    .select("id, organization_id, participant_id, title, requires_signature, status")
    .eq("id", input.document_id)
    .eq("is_visible_to_family", true)
    .maybeSingle();

  if (!doc) return { success: false, error: "Document not found." };
  if (!doc.requires_signature) return { success: false, error: "This document does not require signature." };

  const { data: link } = await (supabase as any)
    .from("participant_network_members")
    .select("permissions")
    .eq("participant_id", doc.participant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!link) return { success: false, error: "You do not have access to this participant." };
  const canSign = link.permissions?.can_sign_documents !== false;
  if (!canSign) return { success: false, error: "Digital signing is disabled for your profile." };

  const reqHeaders = await headers();
  const forwarded = reqHeaders.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || null;
  const ua = reqHeaders.get("user-agent");
  const signedAt = new Date().toISOString();

  const { error } = await (supabase as any)
    .from("participant_documents")
    .update({
      status: "signed",
      signed_by_user_id: user.id,
      signed_at: signedAt,
      signature_data: {
        signed_at: signedAt,
        ip,
        user_agent: ua,
        base64_img: input.signature_base64,
      },
      updated_at: signedAt,
    })
    .eq("id", doc.id);

  if (error) return { success: false, error: error.message };

  // Unlock scheduling by moving pending agreement to active for this participant.
  await (supabase as any)
    .from("service_agreements")
    .update({ status: "active", signed_at: signedAt, signed_by: user.email || user.id })
    .eq("participant_id", doc.participant_id)
    .eq("status", "pending_signature");

  return { success: true };
}

export async function inviteFamilyPortalMember(input: {
  organization_id: string;
  participant_id: string;
  email: string;
  relationship_type: PortalRelationship;
  can_cancel_shifts?: boolean;
  can_sign_documents?: boolean;
}) {
  const { supabase, user } = await getAuthedUser();

  // Require org admin-level caller.
  const { data: member } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", input.organization_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!member || !["owner", "admin", "manager", "office_admin"].includes(member.role)) {
    return { success: false, error: "Only coordinators/admins can send invitations." };
  }

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return { success: false, error: "Missing Supabase service role configuration." };
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const invite = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal`,
  });
  if (invite.error) return { success: false, error: invite.error.message };

  const invitedUserId = invite.data.user?.id;
  if (!invitedUserId) {
    return { success: false, error: "Invite sent, but user ID was not returned." };
  }

  const { error: upsertError } = await admin
    .from("participant_network_members")
    .upsert(
      {
        participant_id: input.participant_id,
        user_id: invitedUserId,
        relationship_type: input.relationship_type,
        permissions: {
          can_cancel_shifts: input.can_cancel_shifts !== false,
          can_sign_documents: input.can_sign_documents !== false,
        },
      },
      { onConflict: "participant_id,user_id" }
    );

  if (upsertError) return { success: false, error: upsertError.message };

  return { success: true, invited_user_id: invitedUserId };
}
