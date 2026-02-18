"use client";

import { GoogleMap, OverlayView } from "@react-google-maps/api";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { getLiveDispatch, type DispatchPin } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { WidgetShell } from "./widget-shell";
import { useGoogleMaps } from "@/components/maps/google-maps-provider";
import type { WidgetSize } from "@/lib/dashboard-store";

const statusConfig = {
  on_job: { color: "bg-emerald-500", ring: "ring-emerald-500/20", label: "On Job" },
  en_route: { color: "bg-sky-400", ring: "ring-sky-400/20", label: "En Route" },
  idle: { color: "bg-zinc-600", ring: "ring-zinc-600/20", label: "Idle" },
};

const statusDotColors: Record<string, string> = {
  on_job: "#10B981",
  en_route: "#38BDF8",
  idle: "#52525B",
};

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#52525b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#27272a" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#18181b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#27272a" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1c1c1e" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#27272a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050505" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const MAP_OPTIONS: google.maps.MapOptions = {
  styles: DARK_STYLES,
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: "greedy",
  backgroundColor: "#050505",
  keyboardShortcuts: false,
};

const BRISBANE_CENTER = { lat: -27.4698, lng: 153.0251 };

interface Pin {
  id: string;
  name: string;
  task: string;
  status: "on_job" | "en_route" | "idle";
  lat: number;
  lng: number;
}

export function WidgetMap({ size = "large" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { orgId } = useOrg();
  const { isLoaded } = useGoogleMaps();
  const [hovered, setHovered] = useState<string | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchPin[]>([]);
  const [loaded, setLoaded] = useState(false);

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
    const channel = supabase
      .channel("live-dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `organization_id=eq.${orgId}` }, () => {
        getLiveDispatch(orgId).then(({ data }) => { if (data) setDispatchData(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  const pins: Pin[] = useMemo(() => {
    if (dispatchData.length === 0) return [];
    return dispatchData
      .filter(d => d.location_lat && d.location_lng)
      .map(d => ({
        id: d.id,
        name: d.name ? d.name.split(" ").map(n => n[0]).join("") + "." : "??",
        task: d.task,
        status: d.dispatch_status === "on_job" ? "on_job" as const : "en_route" as const,
        lat: d.location_lat!,
        lng: d.location_lng!,
      }));
  }, [dispatchData]);

  const mapCenter = useMemo(() => {
    if (pins.length === 0) return BRISBANE_CENTER;
    const avgLat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    const avgLng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;
    return { lat: avgLat, lng: avgLng };
  }, [pins]);

  const activeCount = pins.filter((p) => p.status !== "idle").length;
  const onJobCount = pins.filter((p) => p.status === "on_job").length;
  const enRouteCount = pins.filter((p) => p.status === "en_route").length;

  const fitBounds = useCallback((map: google.maps.Map) => {
    if (pins.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    pins.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 40);
  }, [pins]);

  if (size === "small") {
    return (
      <WidgetShell delay={0.05}>
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center p-3"
          onClick={() => router.push("/dashboard/schedule")}
        >
          <Radio size={14} className="mb-1.5 text-zinc-500" />
          <span className="text-[20px] font-medium text-zinc-100">{activeCount}</span>
          <span className="text-[9px] text-zinc-600">Active Techs</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />{onJobCount}
            </span>
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-sky-400" />{enRouteCount}
            </span>
          </div>
        </div>
      </WidgetShell>
    );
  }

  if (!loaded || !isLoaded) {
    return (
      <WidgetShell delay={0.05}>
        <div className="relative h-full min-h-[120px] overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded bg-zinc-800/80 animate-pulse" />
            <div className="h-3 w-24 rounded bg-zinc-800/80 relative overflow-hidden">
              <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" />
            </div>
          </div>
          <div className="skeleton-shimmer h-full min-h-[80px] rounded-lg bg-[#0a0a0a]" />
        </div>
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
            <span className="text-[13px] font-medium text-zinc-300">Dispatch</span>
            <span className="text-[10px] text-emerald-500">{activeCount} Active</span>
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
          <GoogleMap
            mapContainerClassName="h-full w-full"
            center={mapCenter}
            zoom={13}
            options={MAP_OPTIONS}
            onLoad={fitBounds}
          >
            {pins.map((pin) => (
              <OverlayView key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} mapPaneName={OverlayView.FLOAT_PANE}>
                <div className="relative">
                  <div className={`h-2.5 w-2.5 rounded-full ${statusConfig[pin.status].color} ring-2 ring-black`} />
                </div>
              </OverlayView>
            ))}
          </GoogleMap>

          {loaded && pins.length === 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]/60">
              <div className="text-center">
                <MapPin size={16} strokeWidth={1} className="mx-auto mb-1 text-zinc-700" />
                <p className="text-[10px] text-zinc-600">No active dispatches</p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
          <div className="absolute bottom-2 left-3 z-30 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[8px] text-zinc-600"><span className="h-1 w-1 rounded-full bg-emerald-500" /> On Job</span>
            <span className="flex items-center gap-1 text-[8px] text-zinc-600"><span className="h-1 w-1 rounded-full bg-sky-400" /> En Route</span>
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
            <span className="text-[13px] font-medium text-zinc-300">Live Dispatch</span>
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
        <GoogleMap
          mapContainerClassName="h-full w-full"
          center={mapCenter}
          zoom={13}
          options={MAP_OPTIONS}
          onLoad={fitBounds}
        >
          {pins.map((pin) => {
            const cfg = statusConfig[pin.status];
            const dotColor = statusDotColors[pin.status];
            return (
              <OverlayView key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} mapPaneName={OverlayView.FLOAT_PANE}>
                <div
                  className="relative"
                  onMouseEnter={() => setHovered(pin.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {pin.status !== "idle" && (
                    <motion.div
                      animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`absolute rounded-full ${cfg.color}`}
                      style={{ width: 12, height: 12, left: -2, top: -2 }}
                    />
                  )}
                  <div className={`relative h-3 w-3 cursor-pointer rounded-full ${cfg.color} ring-2 ring-black transition-transform hover:scale-150`} />
                  {hovered === pin.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
                        <span className="text-[11px] font-medium text-zinc-200">{pin.name}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">{pin.task} · {cfg.label}</div>
                      <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-zinc-700 bg-zinc-900" />
                    </motion.div>
                  )}
                </div>
              </OverlayView>
            );
          })}
        </GoogleMap>

        {loaded && pins.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]/60">
            <div className="text-center">
              <MapPin size={20} strokeWidth={1} className="mx-auto mb-1.5 text-zinc-700" />
              <p className="text-[11px] text-zinc-600">No active dispatches</p>
              <p className="mt-0.5 text-[9px] text-zinc-700">Technicians will appear here when jobs are in progress.</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Job</span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> En Route</span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-zinc-600" /> Idle</span>
        </div>
      </div>
    </WidgetShell>
  );
}
