/**
 * @component WidgetMap
 * @status COMPLETE
 * @description Dashboard map widget showing live technician/job pins with Mapbox and realtime updates
 * @lastAudit 2026-03-22
 */
"use client";

import { ArrowRight, MapPin as MapPinIcon, Radio } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { getLiveDispatch, type DispatchPin } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { WidgetShell } from "./widget-shell";
import { useMapbox, MAPBOX_ACCESS_TOKEN } from "@/components/maps/mapbox-provider";
import { MapOfflineFallback } from "@/components/maps/map-offline-fallback";
import { OBSIDIAN_MAP_STYLE, applyObsidianStyle, DEFAULT_MAP_CENTER } from "@/components/maps/obsidian-map-styles";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import type { WidgetSize } from "@/lib/dashboard-store";

/* ── Types ──────────────────────────────────────────── */

interface Pin {
  id: string;
  name: string;
  task: string;
  status: "on_job" | "en_route" | "idle";
  lat: number;
  lng: number;
}

const statusConfigBase = {
  on_job: { labelKey: "On Job" },
  en_route: { labelKey: "En Route" },
  idle: { labelKey: "Idle" },
};

/* ── Mapbox Map Sub-component ───────────────────────── */

function DispatchMapbox({
  pins,
  center,
  className = "",
}: {
  pins: Pin[];
  center: [number, number];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: OBSIDIAN_MAP_STYLE,
        center,
        zoom: 13,
        attributionControl: false,
        logoPosition: "bottom-left",
        fadeDuration: 0,
        pitchWithRotate: false,
        dragRotate: false,
      });

      applyObsidianStyle(map);

      // Hide attribution/logo for clean widget look
      map.on("load", () => {
        const logo = containerRef.current?.querySelector(".mapboxgl-ctrl-logo");
        if (logo) (logo as HTMLElement).style.display = "none";
        const attrib = containerRef.current?.querySelector(".mapboxgl-ctrl-attrib");
        if (attrib) (attrib as HTMLElement).style.display = "none";
        // Force resize after load so the canvas fills the container
        map.resize();
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when pins change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (pins.length === 0) return;

      // Add new markers
      for (const pin of pins) {
        const isActive = pin.status !== "idle";
        const el = document.createElement("div");
        el.style.cssText = `
          width: ${isActive ? "10px" : "8px"};
          height: ${isActive ? "10px" : "8px"};
          border-radius: 50%;
          background: ${isActive ? "#10B981" : "#52525b"};
          border: 2px solid #09090b;
          cursor: pointer;
          transition: transform 0.15s ease;
        `;
        el.title = pin.name ? `${pin.name} · ${pin.task} · ${statusConfigBase[pin.status].labelKey}` : pin.task;
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.4)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }

      // Fit bounds
      if (pins.length === 1) {
        map.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: 14, duration: 800 });
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        pins.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 800 });
      }
    });
  }, [pins]);

  return (
    <div className={`${className} relative`} style={{ background: "#050505" }}>
      <div
        ref={containerRef}
        className="absolute inset-0 [&_.mapboxgl-ctrl-bottom-left]:hidden [&_.mapboxgl-ctrl-bottom-right]:hidden"
      />
    </div>
  );
}

/* ── Main Widget ────────────────────────────────────── */

export function WidgetMap({ size = "large" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { orgId } = useOrg();
  const { t } = useIndustryLexicon();
  const { isLoaded, loadError } = useMapbox();
  const cachedDispatch = useDashboardStore((s) => s.widgetDispatch);
  const setWidgetCache = useDashboardStore((s) => s.setWidgetCache);
  const isWidgetFresh = useDashboardStore((s) => s.isWidgetFresh);
  const [dispatchData, setDispatchData] = useState<DispatchPin[]>(
    (cachedDispatch.data as DispatchPin[] | null) ?? []
  );
  const [loaded, setLoaded] = useState(
    cachedDispatch.data !== null && (cachedDispatch.data as DispatchPin[]).length > 0
  );

  useEffect(() => {
    if (!orgId) return;
    if (isWidgetFresh("widgetDispatch") && cachedDispatch.data) {
      setDispatchData(cachedDispatch.data as DispatchPin[]);
      setLoaded(true);
      return;
    }
    getLiveDispatch(orgId).then(({ data }) => {
      if (data && data.length > 0) {
        setDispatchData(data);
        setWidgetCache("widgetDispatch", data);
      }
      setLoaded(true);
    });
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const refresh = () => {
      getLiveDispatch(orgId).then(({ data }) => {
        if (data) {
          setDispatchData(data);
          setWidgetCache("widgetDispatch", data);
        }
      });
    };
    const channel = supabase
      .channel("live-dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "fleet_positions", filter: `organization_id=eq.${orgId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `organization_id=eq.${orgId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pins: Pin[] = useMemo(() => {
    if (dispatchData.length === 0) return [];
    return dispatchData
      .filter((d) => d.location_lat && d.location_lng)
      .map((d) => ({
        id: d.id,
        name: d.name ? d.name.split(" ").map((n) => n[0]).join("") + "." : "??",
        task: d.task ?? "",
        status: d.dispatch_status === "on_job" ? "on_job" as const
          : d.dispatch_status === "idle" ? "idle" as const
          : "en_route" as const,
        lat: d.location_lat!,
        lng: d.location_lng!,
      }));
  }, [dispatchData]);

  const mapCenter = useMemo((): [number, number] => {
    if (pins.length === 0) return DEFAULT_MAP_CENTER;
    const avgLng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;
    const avgLat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    return [avgLng, avgLat];
  }, [pins]);

  const activeCount = pins.filter((p) => p.status !== "idle").length;
  const onJobCount = pins.filter((p) => p.status === "on_job").length;
  const enRouteCount = pins.filter((p) => p.status === "en_route").length;

  /* ── SMALL: Stats only ──────────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0.05}>
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center p-3"
          onClick={() => router.push("/dashboard/schedule")}
        >
          <Radio size={14} className="mb-1.5 text-zinc-500" />
          <span className="text-[20px] font-medium text-zinc-100">{activeCount}</span>
          <span className="text-[9px] text-zinc-600">Active {t("Techs")}</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" /> {onJobCount}
            </span>
            <span className="flex items-center gap-1 text-[8px] text-zinc-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" /> {enRouteCount}
            </span>
          </div>
        </div>
      </WidgetShell>
    );
  }

  /* ── Loading ────────────────────────────────────── */
  if (!loaded || !isLoaded) {
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

  /* ── Error ──────────────────────────────────────── */
  if (loadError) {
    return (
      <WidgetShell
        delay={0.05}
        header={
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-zinc-400" />
            <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              {size === "medium" ? t("Dispatch") : `Live ${t("Dispatch")}`}
            </span>
            <span className="text-[10px] text-zinc-600">Offline</span>
          </div>
        }
      >
        <div className={`relative h-full overflow-hidden ${size === "medium" ? "min-h-[120px]" : "min-h-[260px]"}`}>
          <MapOfflineFallback className="absolute inset-0 h-full w-full" message="Map Offline" />
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM ─────────────────────────────────────── */
  if (size === "medium") {
    return (
      <WidgetShell
        delay={0.05}
        header={
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-zinc-400" />
            <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">{t("Dispatch")}</span>
            <span className="text-[10px] text-zinc-500">{activeCount} active</span>
          </div>
        }
        action={
          <button onClick={() => router.push("/dashboard/schedule")} className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
            Open <ArrowRight size={12} />
          </button>
        }
      >
        <div className="relative h-full min-h-[120px] overflow-hidden">
          <DispatchMapbox pins={pins} center={mapCenter} className="h-full w-full" />

          {loaded && pins.length === 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]/60">
              <div className="text-center">
                <MapPinIcon size={16} strokeWidth={1} className="mx-auto mb-1 text-zinc-700" />
                <p className="text-[10px] text-zinc-600">{t("No active dispatches")}</p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
          <div className="absolute bottom-2 left-3 z-30 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[8px] text-zinc-600"><span className="h-1 w-1 rounded-full bg-emerald-500" /> {t("On Job")}</span>
            <span className="flex items-center gap-1 text-[8px] text-zinc-600"><span className="h-1 w-1 rounded-full bg-emerald-500" /> {t("En Route")}</span>
          </div>
        </div>
      </WidgetShell>
    );
  }

  /* ── LARGE ──────────────────────────────────────── */
  return (
    <WidgetShell
      delay={0.05}
      header={
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-zinc-400" />
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Live {t("Dispatch")}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {activeCount} Active
          </span>
        </div>
      }
      action={
        <button onClick={() => router.push("/dashboard/schedule")} className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
          Open {t("Dispatch")} <ArrowRight size={12} />
        </button>
      }
    >
      <div className="relative h-full min-h-[260px] overflow-hidden">
        <DispatchMapbox pins={pins} center={mapCenter} className="h-full w-full" />

        {loaded && pins.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0a]/60">
            <div className="text-center">
              <MapPinIcon size={20} strokeWidth={1} className="mx-auto mb-1.5 text-zinc-700" />
              <p className="text-[11px] text-zinc-600">{t("No active dispatches")}</p>
              <p className="mt-0.5 text-[9px] text-zinc-700">{t("Technicians")} will appear here when {t("jobs")} are in progress.</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t("On Job")}</span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t("En Route")}</span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600"><span className="h-1.5 w-1.5 rounded-full bg-zinc-600" /> Idle</span>
        </div>
      </div>
    </WidgetShell>
  );
}
