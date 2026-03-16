"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Glasshouse — Roster List with Worker Bio Modals
   Face-first architecture: worker photo is the most prominent element.
   ═══════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { CalendarDays, User, Circle } from "lucide-react";
import { PortalCancelShiftButton } from "@/components/portal/portal-cancel-shift-button";
import { WorkerBioModal } from "@/components/portal/worker-bio-modal";

export type RosterShift = {
  id: string;
  title: string | null;
  start_time: string;
  end_time?: string;
  is_short_notice?: boolean;
  is_active?: boolean;
  worker?: {
    id?: string | null;
    first_name?: string | null;
    avatar_url?: string | null;
    verified_badge?: boolean;
  } | null;
};

type Props = {
  roster: RosterShift[];
  organizationId: string;
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PortalRosterList({ roster, organizationId }: Props) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedWorkerName, setSelectedWorkerName] = useState("");

  // Group shifts by day
  const grouped = roster.reduce<Record<string, RosterShift[]>>((acc, shift) => {
    const dayKey = new Date(shift.start_time).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(shift);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(grouped).map(([day, shifts]) => (
        <div key={day} className="mb-5">
          {/* Day header */}
          <div className="mb-2 flex items-center gap-2">
            <CalendarDays size={13} className="text-zinc-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{day}</p>
          </div>

          <div className="space-y-2">
            {shifts.map((shift) => {
              const shortNotice = Boolean(shift.is_short_notice);
              const workerName = shift.worker?.first_name || "Pending Worker Match";
              const hasWorker = !!shift.worker?.id;

              return (
                <div
                  key={shift.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-zinc-700"
                >
                  <div className="flex items-start gap-4">
                    {/* Worker avatar — face-first! */}
                    <button
                      onClick={() => {
                        if (hasWorker) {
                          setSelectedWorkerId(shift.worker!.id!);
                          setSelectedWorkerName(workerName);
                        }
                      }}
                      disabled={!hasWorker}
                      className={`group flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition ${
                        hasWorker
                          ? "border-teal-500/30 hover:border-teal-500 cursor-pointer"
                          : "border-zinc-700 cursor-default"
                      }`}
                    >
                      {shift.worker?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={shift.worker.avatar_url}
                          alt={workerName}
                          className="h-full w-full object-cover group-hover:scale-105 transition"
                        />
                      ) : (
                        <User size={22} className={hasWorker ? "text-teal-400" : "text-zinc-600"} />
                      )}
                    </button>

                    {/* Shift details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-100">
                          {fmtTime(shift.start_time)}
                          {shift.end_time && ` – ${fmtTime(shift.end_time)}`}
                        </p>
                        {shift.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            <Circle size={6} className="fill-current animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-300">
                        {shift.title || "Support Visit"}
                      </p>
                      <button
                        onClick={() => {
                          if (hasWorker) {
                            setSelectedWorkerId(shift.worker!.id!);
                            setSelectedWorkerName(workerName);
                          }
                        }}
                        className={`mt-1 text-sm ${
                          hasWorker
                            ? "text-teal-400 hover:text-teal-300 cursor-pointer underline-offset-2 hover:underline"
                            : "text-zinc-500 cursor-default"
                        }`}
                      >
                        {workerName}
                        {shift.worker?.verified_badge && (
                          <span className="ml-1 text-emerald-500">✓</span>
                        )}
                      </button>
                      {shortNotice && (
                        <p className="mt-1 text-[11px] font-semibold text-amber-300">
                          Within 7 days · short-notice cancellation rules apply
                        </p>
                      )}
                    </div>

                    {/* Cancel */}
                    <PortalCancelShiftButton
                      shiftId={shift.id}
                      isShortNotice={shortNotice}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Worker Bio Modal */}
      {selectedWorkerId && (
        <WorkerBioModal
          workerId={selectedWorkerId}
          organizationId={organizationId}
          workerName={selectedWorkerName}
          onClose={() => setSelectedWorkerId(null)}
        />
      )}
    </>
  );
}
