"use client";

/**
 * iWorkr Shimmer/Skeleton Primitives — Obsidian Design System
 *
 * Premium loading states that feel smooth, branded, and polished.
 * Uses the `skeleton-shimmer` CSS class (gradient sweep animation)
 * for a consistent, high-end feel across the entire app.
 *
 * Usage:
 *   <Shimmer className="h-3 w-20" />         — inline text
 *   <ShimmerCircle className="h-8 w-8" />     — avatar
 *   <ShimmerBlock className="h-20 w-full" />  — card area
 *   <ShimmerTableRow columns={5} />            — table row
 *   <ShimmerKpiCard />                         — KPI metric card
 *   <ShimmerListItem />                        — list row with avatar
 *   <ShimmerKanbanColumn />                    — kanban column
 */

interface ShimmerProps {
  className?: string;
}

/** Inline text shimmer — use in place of a text value */
export function Shimmer({ className = "h-3 w-20" }: ShimmerProps) {
  return (
    <span
      className={`relative inline-block overflow-hidden rounded skeleton-shimmer ${className}`}
    />
  );
}

/** Circle shimmer — use for avatars */
export function ShimmerCircle({ className = "h-6 w-6" }: ShimmerProps) {
  return (
    <span
      className={`relative inline-block overflow-hidden rounded-full skeleton-shimmer ${className}`}
    />
  );
}

/** Block shimmer — use for card areas */
export function ShimmerBlock({ className = "h-20 w-full" }: ShimmerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg skeleton-shimmer ${className}`}
    />
  );
}

/** Row of shimmer placeholders for a team member list */
export function ShimmerTeamRow() {
  return (
    <div className="flex items-center gap-2 px-2 py-[5px]">
      <ShimmerCircle className="h-5 w-5" />
      <Shimmer className="h-3 w-24" />
      <span className="ml-auto"><Shimmer className="h-2 w-10" /></span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * Composite Skeletons — Drop-in loading states for common layouts
 * ═══════════════════════════════════════════════════════════════ */

/** Table row with variable columns */
export function ShimmerTableRow({
  columns = 5,
  className = "",
}: {
  columns?: number;
  className?: string;
}) {
  const widths = ["w-16", "w-24", "w-20", "w-32", "w-14", "w-28", "w-20"];
  return (
    <div className={`flex items-center gap-4 px-5 py-3 border-b border-white/[0.03] ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Shimmer key={i} className={`h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

/** KPI/metric card skeleton */
export function ShimmerKpiCard({ className = "" }: ShimmerProps) {
  return (
    <div className={`rounded-xl border border-white/[0.04] bg-white/[0.02] p-5 ${className}`}>
      <Shimmer className="mb-3 h-3 w-16" />
      <Shimmer className="mb-2 h-7 w-24" />
      <Shimmer className="h-3 w-12" />
    </div>
  );
}

/** List item with avatar + title + subtitle */
export function ShimmerListItem({ className = "" }: ShimmerProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] ${className}`}>
      <ShimmerCircle className="h-9 w-9 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Shimmer className="h-3 w-3/5" />
        <Shimmer className="h-2.5 w-2/5" />
      </div>
      <Shimmer className="h-3 w-10" />
    </div>
  );
}

/** Kanban column with header + cards */
export function ShimmerKanbanColumn({ cards = 3, className = "" }: { cards?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 w-[280px] shrink-0 ${className}`}>
      <div className="flex items-center justify-between px-2 py-2">
        <Shimmer className="h-3 w-20" />
        <ShimmerCircle className="h-5 w-5 rounded-md" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-2.5">
          <Shimmer className="h-3.5 w-4/5" />
          <Shimmer className="h-2.5 w-3/5" />
          <div className="flex items-center gap-2 pt-1">
            <ShimmerCircle className="h-5 w-5" />
            <Shimmer className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chat/message list skeleton */
export function ShimmerChatList({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03]">
          <ShimmerCircle className="h-10 w-10 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <Shimmer className="h-3 w-28" />
              <Shimmer className="h-2.5 w-10" />
            </div>
            <Shimmer className="h-2.5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Schedule timeline row skeleton */
export function ShimmerScheduleRow({ className = "" }: ShimmerProps) {
  return (
    <div className={`flex border-b border-white/[0.03] ${className}`}>
      <div className="flex shrink-0 items-center gap-3 border-r border-white/[0.04] px-4" style={{ width: 220, height: 88 }}>
        <ShimmerCircle className="h-9 w-9" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-2 w-14" />
          <div className="h-[3px] w-full rounded-full skeleton-shimmer" />
        </div>
      </div>
      <div className="relative flex-1" style={{ height: 88 }}>
        <div
          className="absolute top-2 rounded-lg skeleton-shimmer"
          style={{
            left: `${10 + Math.random() * 20}%`,
            width: `${15 + Math.random() * 25}%`,
            height: 88 - 16,
          }}
        />
      </div>
    </div>
  );
}

/** Bento grid card skeleton (for dashboards) */
export function ShimmerBentoCard({
  className = "",
  hasChart = false,
}: {
  className?: string;
  hasChart?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.04] bg-white/[0.02] p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Shimmer className="h-4 w-28" />
        <Shimmer className="h-3 w-12" />
      </div>
      {hasChart ? (
        <ShimmerBlock className="h-32 w-full rounded-lg" />
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ShimmerListItem key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
