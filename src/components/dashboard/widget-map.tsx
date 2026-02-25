"use client";

import { Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { getLiveDispatch, type DispatchPin } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { WidgetShell } from "./widget-shell";
import { useGoogleMaps } from "@/components/maps/google-maps-provider";
import { MapOfflineFallback } from "@/components/maps/map-offline-fallback";
import { MapDevelopmentDetector } from "@/components/maps/map-development-detector";
import { OBSIDIAN_MAP_STYLES, DEFAULT_MAP_CENTER } from "@/components/maps/obsidian-map-styles";
import { LottieIcon } from "./lottie-icon";
import { radarScanAnimation } from "./lottie-data-relay";
import type { WidgetSize } from "@/lib/dashboard-store";

const statusConfig = {
  on_job: { color: "bg-emerald-500", label: "On Job" },
  en_route: { color: "bg-emerald-500", label: "En Route" },
  idle: { color: "bg-zinc-600", label: "Idle" },
};

/** Icon configs for legacy Marker — created only when Maps API is loaded to avoid "google is not defined" on dashboard. */
function getWidgetMapIcons(): {
  emerald: google.maps.Symbol;
  white: google.maps.Symbol;
  zinc: google.maps.Symbol;
} | null {
  if (typeof globalThis === "undefined") return null;
  const g = (globalThis as { google?: { maps?: { SymbolPath?: typeof google.maps.SymbolPath } } }).google;
  if (!g?.maps?.SymbolPath) return null;
  return {
    emerald: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#10B981",
      fillOpacity: 1,
      strokeColor: "#050505",
      strokeWeight: 1,
    },
    white: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#ffffff",
      fillOpacity: 1,
      strokeColor: "#27272a",
      strokeWeight: 1,
    },
    zinc: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#52525b",
      fillOpacity: 1,
      strokeColor: "#27272a",
      strokeWeight: 1,
    },
  };
}

interface Pin {
  id: string;
  name: string;
  task: string;
  status: "on_job" | "en_route" | "idle";
  lat: number;
  lng: number;
}

/** Fits map bounds to pins when map is ready. */
function FitBoundsToPins({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || pins.length === 0) return;
    if (pins.length === 1) {
      map.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 50);
  }, [map, pins]);
  return null;
}

export function WidgetMap({ size = "large" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { orgId } = useOrg();
  const { isLoaded, loadError } = useGoogleMaps();
  const [hovered, setHovered] = useState<string | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchPin[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [developmentMode, setDevelopmentMode] = useState(false);
  const icons = useMemo(() => getWidgetMapIcons(), [isLoaded]);

  useEffect(() => {
    if (!orgId) return;
    getLiveDispatch(orgId).then(({ data }) => {
      if (data && data.length > 0) setDispatchData(data);
      setLoaded(true);
    });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const refresh = () => {
      getLiveDispatch(orgId).then(({ data }) => {
        if (data) setDispatchData(data);
      });
    };
    const channel = supabase
      .channel("live-dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "fleet_positions", filter: `organization_id=eq.${orgId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `organization_id=eq.${orgId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const pins: Pin[] = useMemo(() => {
    if (dispatchData.length === 0) return [];
    return dispatchData
      .filter((d) => d.location_lat && d.location_lng)
      .map((d) => ({
        id: d.id,
        name: d.name
          ? d.name
              .split(" ")
              .map((n) => n[0])
              .join("") + "."
          : "??",
        task: d.task ?? "",
        status:
          d.dispatch_status === "on_job"
            ? ("on_job" as const)
            : d.dispatch_status === "idle"
              ? ("idle" as const)
              : ("en_route" as const),
        lat: d.location_lat!,
        lng: d.location_lng!,
      }));
  }, [dispatchData]);

  const mapCenter = useMemo(() => {
    if (pins.length === 0) return DEFAULT_MAP_CENTER;
    const avgLat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    const avgLng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;
    return { lat: avgLat, lng: avgLng };
  }, [pins]);

  const activeCount = pins.filter((p) => p.status !== "idle").length;
  const onJobCount = pins.filter((p) => p.status === "on_job").length;
  const enRouteCount = pins.filter((p) => p.status === "en_route").length;

  if (size === "small") {
    return (
      <WidgetShell delay={0.05}>
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center p-3"
          onClick={() => router.push("/dashboard/schedule")}
        >
          <Radio size={14} className="mb-1.5 text-zinc-500" />
          <span className="text-[20px] font-medium text-zinc-100">
            {activeCount}
          </span>
          <span className="text-[9px] text-zinc-600">Active Techs</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              {onJobCount}
            </span>
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              {enRouteCount}
            </span>
          </div>
        </div>
      </WidgetShell>
    );
  }

  if (!loaded || !isLoaded || !icons) {
    return (
      <WidgetShell delay={0.05}>
        <div className="relative h-full min-h-[120px] overflow-hidden p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded bg-zinc-800/80" />
            <div className="relative h-3 w-24 overflow-hidden rounded bg-zinc-800/80">
              <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" />
            </div>
          </div>
          <div className="skeleton-shimmer h-full min-h-[80px] rounded-lg bg-[#0a0a0a]" />
        </div>
      </WidgetShell>
    );
  }

  if (loadError || developmentMode) {
    const fallbackContent = (
      <div
        className={`relative h-full overflow-hidden ${size === "medium" ? "min-h-[120px]" : "min-h-[260px]"}`}
      >
        <MapOfflineFallback
          className="absolute inset-0 h-full w-full"
          message="Map Offline"
          subtext={developmentMode ? "Enable billing in Google Cloud for this project to use Maps." : "Establishing link… or check API configuration."}
        />
      </div>
    );
    if (size === "medium") {
      return (
        <WidgetShell
          delay={0.05}
          header={
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-zinc-400" />
              <span className="text-[13px] font-medium text-zinc-300">
                Dispatch
              </span>
              <span className="text-[10px] text-zinc-600">Offline</span>
            </div>
          }
          action={
            <button
              onClick={() => router.push("/dashboard/schedule")}
              className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Open <ArrowRight size={12} />
            </button>
          }
        >
          {fallbackContent}
        </WidgetShell>
      );
    }
    return (
      <WidgetShell
        delay={0.05}
        header={
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">
              Live Dispatch
            </span>
            <span className="text-[10px] text-zinc-600">Map unavailable</span>
          </div>
        }
        action={
          <button
            onClick={() => router.push("/dashboard/schedule")}
            className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Open Dispatch <ArrowRight size={12} />
          </button>
        }
      >
        {fallbackContent}
      </WidgetShell>
    );
  }

  if (size === "medium") {
    return (
      <WidgetShell
        delay={0.05}
        header={
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">
              Dispatch
            </span>
            <span className="text-[10px] text-emerald-500">
              {activeCount} Active
            </span>
          </div>
        }
        action={
          <button
            onClick={() => router.push("/dashboard/schedule")}
            className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Open <ArrowRight size={12} />
          </button>
        }
      >
        <div className="relative h-full min-h-[120px] overflow-hidden">
          <div className="h-full w-full rounded-xl border border-white/5 bg-zinc-950">
            <Map
              defaultCenter={mapCenter}
              defaultZoom={13}
              center={mapCenter}
              zoom={13}
              style={{ width: "100%", height: "100%" }}
              styles={OBSIDIAN_MAP_STYLES}
              disableDefaultUI
              zoomControl={false}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              clickableIcons={false}
              gestureHandling="greedy"
            >
              <MapDevelopmentDetector onDevelopmentMode={() => setDevelopmentMode(true)} />
              <FitBoundsToPins pins={pins} />
              {pins.map((pin) => (
                <Marker
                  key={pin.id}
                  position={{ lat: pin.lat, lng: pin.lng }}
                  icon={pin.status === "idle" ? icons.zinc : icons.emerald}
                  title={pin.name ? `${pin.name} · ${pin.task}` : pin.task}
                />
              ))}
            </Map>
          </div>

          {loaded && pins.length === 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]/60">
              <div className="text-center">
                <MapPin
                  size={16}
                  strokeWidth={1}
                  className="mx-auto mb-1 text-zinc-700"
                />
                <p className="text-[10px] text-zinc-600">No active dispatches</p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
          <div className="absolute bottom-2 left-3 z-30 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" /> On Job
            </span>
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" /> En Route
            </span>
          </div>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      delay={0.05}
      header={
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5">
            <Radio size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">
              Live Dispatch
            </span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {activeCount} Active
          </span>
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/schedule")}
          className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Open Dispatch <ArrowRight size={12} />
        </button>
      }
    >
      <div className="relative h-full min-h-[260px] overflow-hidden">
        <div className="h-full w-full rounded-xl border border-white/5 bg-zinc-950">
          <Map
            defaultCenter={mapCenter}
            defaultZoom={13}
            center={mapCenter}
            zoom={13}
            style={{ width: "100%", height: "100%" }}
            styles={OBSIDIAN_MAP_STYLES}
            disableDefaultUI
            zoomControl={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            clickableIcons={false}
            gestureHandling="greedy"
          >
            <MapDevelopmentDetector onDevelopmentMode={() => setDevelopmentMode(true)} />
            <FitBoundsToPins pins={pins} />
            {pins.map((pin) => {
              const cfg = statusConfig[pin.status];
              const isLive = pin.status !== "idle";
              return (
                <Marker
                  key={pin.id}
                  position={{ lat: pin.lat, lng: pin.lng }}
                  icon={isLive ? icons.emerald : icons.zinc}
                  title={pin.name ? `${pin.name} · ${pin.task} · ${cfg.label}` : `${pin.task} · ${cfg.label}`}
                />
              );
            })}
          </Map>
        </div>

        {loaded && pins.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]/60">
            <div className="text-center">
              <MapPin
                size={20}
                strokeWidth={1}
                className="mx-auto mb-1.5 text-zinc-700"
              />
              <p className="text-[11px] text-zinc-600">No active dispatches</p>
              <p className="mt-0.5 text-[9px] text-zinc-700">
                Technicians will appear here when jobs are in progress.
              </p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Job
          </span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> En
            Route
          </span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" /> Idle
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}
