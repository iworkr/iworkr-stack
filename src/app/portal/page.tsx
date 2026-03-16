import { getPortalDashboard } from "@/app/actions/portal-family";
import { FamilyPortalShell } from "@/components/portal/family-portal-shell";
import { Clock, User, CalendarDays, DollarSign, Circle, MessageCircle, ArrowRight, Heart } from "lucide-react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════
   Project Glasshouse — Family Portal Home
   Warm "Obsidian Glass" design. Face-first worker visuals.
   Zero-jargon, trust-building. WCAG 2.1 AAA typography.
   ═══════════════════════════════════════════════════════════════════ */

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ participant?: string }>;
}) {
  const params = await searchParams;
  const data = await getPortalDashboard(params.participant);

  if ("error" in data) {
    return (
      <main className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-200">
        <div className="mx-auto max-w-md text-center">
          <Heart size={40} className="mx-auto mb-4 text-teal-500" />
          <h1 className="text-2xl font-semibold">Family Portal</h1>
          <p className="mt-4 text-zinc-400">{data.error}</p>
        </div>
      </main>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shift = data.next_shift as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budget = data.budget as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comms = data.communications as any;

  const participantName =
    data.linked_participants.find(
      (p: { participant_id: string }) => p.participant_id === data.active_participant_id
    )?.participant_name || "Your participant";

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-50">
      <FamilyPortalShell
        participants={data.linked_participants}
        activeParticipantId={data.active_participant_id}
      />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {/* ── Hero: Next Visit ──────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-zinc-900 p-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-teal-400">
            What&apos;s happening next?
          </p>

          {!shift ? (
            <div className="flex items-center gap-3">
              <CalendarDays size={28} className="text-zinc-600" />
              <div>
                <p className="text-lg font-semibold text-zinc-200">No upcoming visits</p>
                <p className="text-sm text-zinc-400">
                  {participantName} has no published visits in the next window.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              {/* Worker avatar — face-first */}
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-teal-500/30 bg-teal-500/10">
                {shift.worker?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shift.worker.avatar_url}
                    alt={shift.worker.first_name || "Worker"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={24} className="text-teal-400" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-xl font-bold text-zinc-50">
                  {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
                </p>
                <p className="mt-0.5 text-sm text-zinc-200">
                  {shift.title || "Support Visit"}
                </p>
                <p className="mt-1 text-sm text-teal-300">
                  {shift.worker?.first_name || "Pending Worker Match"}
                  {shift.worker?.verified_badge && (
                    <span className="ml-1 text-emerald-500">✓ Verified</span>
                  )}
                </p>

                {shift.is_active && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-400">
                    <Circle size={6} className="fill-current animate-pulse" />
                    Visit in progress
                  </span>
                )}
              </div>
            </div>
          )}

          <Link
            href={`/portal/roster?participant=${data.active_participant_id}`}
            className="mt-4 flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 transition"
          >
            View full roster <ArrowRight size={14} />
          </Link>
        </section>

        {/* ── Budget Telemetry ──────────────────────────────── */}
        {budget && budget.total > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <DollarSign size={14} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Funding Summary
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-zinc-800/50 p-3">
                <p className="text-[11px] text-zinc-500">Total Plan</p>
                <p className="mt-1 text-lg font-bold text-zinc-100">
                  ${budget.total.toLocaleString("en-AU")}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-800/50 p-3">
                <p className="text-[11px] text-zinc-500">Used</p>
                <p className="mt-1 text-lg font-bold text-zinc-300">
                  ${budget.consumed.toLocaleString("en-AU")}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                <p className="text-[11px] text-emerald-400">Remaining</p>
                <p className="mt-1 text-lg font-bold text-emerald-400">
                  ${budget.remaining.toLocaleString("en-AU")}
                </p>
              </div>
            </div>

            {/* Pacing bar */}
            {budget.total > 0 && (
              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budget.consumed / budget.total > 0.8
                        ? "bg-amber-500"
                        : "bg-teal-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (budget.consumed / budget.total) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">{budget.safe_burn_text}</p>
              </div>
            )}

            <Link
              href={`/portal/funds?participant=${data.active_participant_id}`}
              className="mt-3 flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 transition"
            >
              View funding details <ArrowRight size={14} />
            </Link>
          </section>
        )}

        {/* ── Recent Updates ──────────────────────────────────── */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-zinc-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Recent Activity
              </p>
            </div>
            {comms.unread_count > 0 && (
              <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                {comms.unread_count} new
              </span>
            )}
          </div>

          {comms.latest.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No messages yet. The care team will share updates here.
            </p>
          ) : (
            <div className="space-y-2">
              {comms.latest.slice(0, 3).map((msg: { id: string; content: string; created_at: string }) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                >
                  <p className="text-sm text-zinc-300">{msg.content}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-600">
                    <Clock size={10} />
                    {fmtDateTime(msg.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Link
            href={`/portal/updates?participant=${data.active_participant_id}`}
            className="mt-3 flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 transition"
          >
            View all updates <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </main>
  );
}
