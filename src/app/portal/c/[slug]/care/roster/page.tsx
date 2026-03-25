/**
 * @page /portal/c/[slug]/care/roster
 * @status COMPLETE
 * @description NDIS calendar view — scheduled, en-route, and completed shifts with worker info
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, User, Clock, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalCareRoster } from "@/app/actions/portal-client";

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
}

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  shift_note: string | null;
  client_approved: boolean;
  worker_name: string | null;
  worker_avatar: string | null;
  billable_hours: number | null;
}

export default function PortalCareRosterPage() {
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const tenant = usePortalStore((s) => s.activeTenant);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const brandColor = tenant?.brand_color || "#10B981";

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1 + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  useEffect(() => {
    if (!activeEntityId) return;
    setLoading(true);
    getPortalCareRoster(
      activeEntityId,
      weekStart.toISOString(),
      weekEnd.toISOString()
    ).then((result) => {
      setShifts((result.shifts || []) as Shift[]);
      setLoading(false);
    });
  }, [activeEntityId, weekStart, weekEnd]);

  const grouped = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const day = new Date(shift.start_time).toDateString();
      const arr = map.get(day) || [];
      arr.push(shift);
      map.set(day, arr);
    }
    const days: Array<{ date: Date; shifts: Shift[] }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dayShifts = map.get(d.toDateString()) || [];
      days.push({ date: d, shifts: dayShifts });
    }
    return days;
  }, [shifts, weekStart]);

  const weekLabel = `${weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} — ${weekEnd.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Care Roster</h1>
          <p className="text-[12px] text-zinc-500">Your scheduled visits and support sessions</p>
        </div>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/30 px-4 py-3">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[13px] font-medium text-zinc-300">{weekLabel}</p>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Today button */}
      {weekOffset !== 0 && (
        <button
          onClick={() => setWeekOffset(0)}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
          style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
        >
          Back to this week
        </button>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ date, shifts: dayShifts }) => {
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div key={date.toISOString()}>
                <div className="mb-2 flex items-center gap-2">
                  <p className={`text-[12px] font-medium ${isToday ? "" : "text-zinc-500"}`}
                    style={isToday ? { color: brandColor } : undefined}
                  >
                    {isToday ? "Today" : fmtDay(date)}
                  </p>
                  {isToday && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
                  )}
                </div>

                {dayShifts.length === 0 ? (
                  <div className="rounded-lg border border-white/[0.04] bg-zinc-950/20 px-4 py-3 text-[12px] text-zinc-600">
                    No visits scheduled
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map((shift) => {
                      const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
                        scheduled: { bg: "bg-sky-500/10", text: "text-sky-400", label: "Scheduled" },
                        en_route: { bg: "bg-amber-500/10", text: "text-amber-400", label: "En Route" },
                        in_progress: { bg: "bg-blue-500/10", text: "text-blue-400", label: "In Progress" },
                        on_site: { bg: "bg-blue-500/10", text: "text-blue-400", label: "On Site" },
                        complete: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Completed" },
                      };
                      const sc = statusConfig[shift.status] || statusConfig.scheduled;

                      return (
                        <motion.div
                          key={shift.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800">
                              {shift.worker_avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={shift.worker_avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <User size={16} className="text-zinc-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[13px] font-medium text-zinc-200">
                                  {shift.worker_name || "Support Worker"}
                                </p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                                  {sc.label}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                                <Clock size={10} />
                                {fmtTime(shift.start_time)} — {fmtTime(shift.end_time)}
                                {shift.billable_hours && (
                                  <span className="text-zinc-600">({shift.billable_hours}h)</span>
                                )}
                              </div>
                              {shift.shift_note && (
                                <p className="mt-2 text-[12px] text-zinc-400">{shift.shift_note}</p>
                              )}
                              {shift.client_approved && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
                                  <CheckCircle size={10} /> Signed off
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
