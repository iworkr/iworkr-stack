"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";

export interface JobMarkerData {
  id: string;
  title: string;
  lat: number;
  lng: number;
  variant: "unassigned" | "scheduled" | "in_progress" | "urgent";
}

interface JobLayerProps {
  jobs: JobMarkerData[];
  visible: boolean;
  onJobClick: (jobId: string, title: string) => void;
}

/* ── PRD §5.2: Job Site Marker — "The Target" ───────────
   White dot (w-2.5 h-2.5 = 10px), border-2 border-zinc-900.
   Urgent/overdue → bg-rose-500. In-progress → bg-violet-500.
   Unassigned → dark fill + white border (inverted).
   ─────────────────────────────────────────────────────── */

const variantStyles: Record<JobMarkerData["variant"], string> = {
  unassigned: "h-3 w-3 border-2 border-white bg-zinc-950",
  scheduled:  "h-2.5 w-2.5 border-2 border-zinc-900 bg-white",
  in_progress: "h-2.5 w-2.5 border-2 border-zinc-900 bg-violet-500",
  urgent:     "h-2.5 w-2.5 border-2 border-zinc-900 bg-rose-500",
};

export function JobLayer({ jobs, visible, onJobClick }: JobLayerProps) {
  if (!visible || jobs.length === 0) return null;

  /* PRD §4.1: z-20 for all map markers. Urgent/in_progress get +2 priority */
  const zIndex = (variant: JobMarkerData["variant"]) =>
    variant === "in_progress" || variant === "urgent" ? 22 : 20;

  return (
    <>
      {jobs.map((job) => (
        <AdvancedMarker
          key={job.id}
          position={{ lat: job.lat, lng: job.lng }}
          title={job.title}
          zIndex={zIndex(job.variant)}
          onClick={() => onJobClick(job.id, job.title)}
        >
          <div
            className={`cursor-pointer rounded-full shadow-sm transition-transform duration-100 hover:scale-125 ${variantStyles[job.variant]}`}
          />
        </AdvancedMarker>
      ))}
    </>
  );
}
