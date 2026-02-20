"use client";

import { useMemo } from "react";
import { Marker } from "@vis.gl/react-google-maps";

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

function getJobIcons(): Record<JobMarkerData["variant"], google.maps.Symbol> | null {
  if (typeof globalThis === "undefined") return null;
  const g = (globalThis as { google?: { maps?: { SymbolPath?: typeof google.maps.SymbolPath } } }).google;
  if (!g?.maps?.SymbolPath) return null;
  return {
    unassigned: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#050505",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
    scheduled: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#ffffff",
      fillOpacity: 1,
      strokeColor: "#27272a",
      strokeWeight: 1,
    },
    in_progress: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#8b5cf6",
      fillOpacity: 1,
      strokeColor: "#27272a",
      strokeWeight: 1,
    },
    urgent: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#f43f5e",
      fillOpacity: 1,
      strokeColor: "#27272a",
      strokeWeight: 1,
    },
  };
}

export function JobLayer({ jobs, visible, onJobClick }: JobLayerProps) {
  const jobIcons = useMemo(() => getJobIcons(), []);
  if (!visible || jobs.length === 0 || !jobIcons) return null;

  const zIndex = (variant: JobMarkerData["variant"]) =>
    variant === "in_progress" || variant === "urgent" ? 400 : 300;

  return (
    <>
      {jobs.map((job) => (
        <Marker
          key={job.id}
          position={{ lat: job.lat, lng: job.lng }}
          icon={jobIcons[job.variant]}
          title={job.title}
          zIndex={zIndex(job.variant)}
          onClick={() => onJobClick(job.id, job.title)}
        />
      ))}
    </>
  );
}
