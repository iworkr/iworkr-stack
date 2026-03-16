import { getPortalRoster } from "@/app/actions/portal-family";
import { FamilyPortalShell } from "@/components/portal/family-portal-shell";
import { PortalRosterList, type RosterShift } from "@/components/portal/portal-roster-list";
import { CalendarDays } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Project Glasshouse — Enhanced Roster Page
   Face-first worker avatars, day-grouped timeline, Worker Bio modals.
   ═══════════════════════════════════════════════════════════════════ */

export default async function PortalRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ participant?: string }>;
}) {
  const params = await searchParams;
  const data = await getPortalRoster(params.participant);

  if ("error" in data) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-200">
        <h1 className="text-2xl font-semibold">Roster</h1>
        <p className="mt-4 text-zinc-400">{data.error}</p>
      </main>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roster: RosterShift[] = ((data as any).roster || []).map((shift: any) => ({
    id: shift.id,
    title: shift.title || null,
    start_time: shift.start_time,
    end_time: shift.end_time || undefined,
    is_short_notice: shift.is_short_notice || false,
    is_active: shift.is_active || false,
    worker: shift.worker
      ? {
          id: shift.worker.id || shift.worker.user_id || null,
          first_name: shift.worker.first_name || shift.worker.full_name?.split(" ")[0] || null,
          avatar_url: shift.worker.avatar_url || null,
          verified_badge: shift.worker.verified_badge || false,
        }
      : null,
  }));

  // Resolve organization ID from the linked participants data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizationId = (data as any).organization_id || "";

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-50">
      <FamilyPortalShell
        participants={data.linked_participants}
        activeParticipantId={data.active_participant_id}
      />
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-teal-400" />
          <h1 className="text-lg font-semibold">Upcoming Visits</h1>
        </div>
        <p className="mb-6 text-sm text-zinc-400">
          Published and active visits. Tap a worker&apos;s photo to see their profile.
        </p>

        {roster.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <CalendarDays size={32} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-400">No upcoming visits are published yet.</p>
          </div>
        ) : (
          <PortalRosterList roster={roster} organizationId={organizationId} />
        )}
      </div>
    </main>
  );
}
