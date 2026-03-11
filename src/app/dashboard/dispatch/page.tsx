"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { getLiveDispatch, getFootprintTrails, snapFootprintToRoads, type DispatchPin } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { useShellStore } from "@/lib/shell-store";
import { useFleetTracking } from "@/lib/hooks/use-fleet-tracking";
import { useMapbox, MAPBOX_ACCESS_TOKEN } from "@/components/maps/mapbox-provider";
import { OBSIDIAN_MAP_STYLE, applyObsidianStyle, DEFAULT_MAP_CENTER } from "@/components/maps/obsidian-map-styles";
import { MapOfflineFallback } from "@/components/maps/map-offline-fallback";
import { DispatchMapProvider } from "@/components/dispatch/dispatch-map-context";
import { FleetLayer, type FleetTech } from "@/components/dispatch/fleet-layer";
import { JobLayer, type JobMarkerData } from "@/components/dispatch/job-layer";
import { RoutingLayer } from "@/components/dispatch/routing-layer";
import { FootprintsLayer, type FootprintTrail } from "@/components/dispatch/footprints-layer";
import { DispatchCommandPanel } from "@/components/dispatch/dispatch-command-panel";
import { DispatchRoster } from "@/components/dispatch/dispatch-roster";
import { DispatchSearch } from "@/components/dispatch/dispatch-search";
import { HoverDialog, type HoverDialogTech } from "@/components/dispatch/hover-dialog";
import { useJobsStore } from "@/lib/jobs-store";
import { FeatureGate } from "@/components/app/feature-gate";

export default function DispatchPage() {
  const { orgId } = useOrg();
  const { isLoaded, loadError } = useMapbox();
  const openSlideOver = useShellStore((s) => s.openSlideOver);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [dispatchPins, setDispatchPins] = useState<DispatchPin[]>([]);
  const [footprints, setFootprints] = useState<FootprintTrail[]>([]);
  const [snappedFootprints, setSnappedFootprints] = useState<Map<string, { lat: number; lng: number }[]>>(new Map());
  const snappedRequestedRef = useRef<Set<string>>(new Set());
  const [hoveredTechId, setHoveredTechId] = useState<string | null>(null);
  const [hoverDialogTech, setHoverDialogTech] = useState<HoverDialogTech | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<{ lat: number; lng: number } | null>(null);
  const [rippleTechId, setRippleTechId] = useState<string | null>(null);
  const [showFleet, setShowFleet] = useState(true);
  const [showUnassignedJobs, setShowUnassignedJobs] = useState(true);
  const [showActiveRoutes, setShowActiveRoutes] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const jobs = useJobsStore((s) => s.jobs);
  const loadFromServer = useJobsStore((s) => s.loadFromServer);

  useFleetTracking({ orgId, enabled: true });

  // Initialize Mapbox map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled || !mapContainerRef.current) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: OBSIDIAN_MAP_STYLE,
        center: DEFAULT_MAP_CENTER,
        zoom: 12,
        attributionControl: false,
        logoPosition: "bottom-left",
        fadeDuration: 0,
        pitchWithRotate: false,
        dragRotate: false,
      });

      applyObsidianStyle(map);

      // Add navigation controls (zoom only, no compass)
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
        "bottom-right"
      );

      map.on("load", () => {
        // Hide Mapbox branding for cleaner command center look
        const logo = mapContainerRef.current?.querySelector(".mapboxgl-ctrl-logo");
        if (logo) (logo as HTMLElement).style.display = "none";
        const attrib = mapContainerRef.current?.querySelector(".mapboxgl-ctrl-attrib");
        if (attrib) (attrib as HTMLElement).style.display = "none";

        // Force canvas to fill the container — prevents black screen
        map.resize();

        mapRef.current = map;
        setMapReady(true);
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [isLoaded]);

  // Fit bounds when dispatch data loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const points: [number, number][] = [];
    dispatchPins.forEach((t) => {
      if (t.location_lat != null && t.location_lng != null) points.push([t.location_lng, t.location_lat]);
    });
    jobs.forEach((j) => {
      if (j.locationCoords?.lat != null && j.locationCoords?.lng != null) points.push([j.locationCoords.lng, j.locationCoords.lat]);
    });

    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 14, duration: 800 });
      return;
    }

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 800 });
    });
  }, [mapReady, dispatchPins, jobs]);

  useEffect(() => {
    if (!orgId) return;
    loadFromServer(orgId);
  }, [orgId, loadFromServer]);

  useEffect(() => {
    if (!orgId) return;
    getLiveDispatch(orgId).then(({ data }) => {
      if (data) setDispatchPins(data);
    });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    getFootprintTrails(orgId).then(({ data }) => {
      if (data) setFootprints(data);
    });
  }, [orgId]);

  useEffect(() => {
    if (!showFootprints || footprints.length === 0) return;
    footprints.forEach((trail) => {
      if (trail.path.length < 2) return;
      if (snappedRequestedRef.current.has(trail.techId)) return;
      snappedRequestedRef.current.add(trail.techId);
      snapFootprintToRoads(trail.path).then(({ data }) => {
        if (data && data.length >= 2) {
          setSnappedFootprints((prev) => new Map(prev).set(trail.techId, data));
        }
      });
    });
  }, [showFootprints, footprints]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const refresh = () => {
      getLiveDispatch(orgId).then(({ data }) => { if (data) setDispatchPins(data); });
    };
    const ch = supabase
      .channel("dispatch-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "fleet_positions", filter: `organization_id=eq.${orgId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `organization_id=eq.${orgId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const jobMarkers: JobMarkerData[] = useMemo(() => {
    return jobs
      .filter((j) => j.locationCoords?.lat != null && j.locationCoords?.lng != null)
      .map((j) => ({
        id: j.id,
        title: j.title,
        lat: j.locationCoords!.lat,
        lng: j.locationCoords!.lng,
        variant: ((): JobMarkerData["variant"] => {
          if (!j.assignee || j.assignee === "Unassigned") return "unassigned";
          if (j.status === "in_progress") return "in_progress";
          if (j.priority === "urgent" || j.status === "urgent") return "urgent";
          return "scheduled";
        })(),
      }));
  }, [jobs]);

  const fleetTechs: FleetTech[] = useMemo(
    () =>
      dispatchPins
        .filter((p) => p.location_lat != null && p.location_lng != null)
        .map((p) => ({
          ...p,
          heading: p.heading ?? 0,
          speedKmh: p.speed != null ? p.speed : undefined,
        })),
    [dispatchPins]
  );

  const jobsWithCoords = useMemo(
    () =>
      jobs
        .filter((j) => j.locationCoords?.lat != null && j.locationCoords?.lng != null)
        .map((j) => ({
          id: j.dbId,
          location_lat: j.locationCoords!.lat,
          location_lng: j.locationCoords!.lng,
        })),
    [jobs]
  );

  const footprintsToRender = useMemo(() => {
    if (!showFootprints) return [];
    return footprints.map((t) => ({
      ...t,
      path: snappedFootprints.get(t.techId) ?? t.path,
    }));
  }, [showFootprints, footprints, snappedFootprints]);

  const handleLocateTech = useCallback((_techId: string, _lat: number, _lng: number) => {
    setRippleTechId(_techId);
    setTimeout(() => setRippleTechId(null), 1500);
  }, []);

  const handleHoverTechDetail = useCallback((tech: FleetTech | null, anchor: { lat: number; lng: number } | null) => {
    setHoverDialogTech(tech);
    setHoverAnchor(anchor);
  }, []);

  const handleJobClick = useCallback(
    (jobId: string, title: string) => {
      openSlideOver({ type: "Job", id: jobId, title });
    },
    [openSlideOver]
  );

  const handleSearch = useCallback((_query: string) => {
    setSearchOpen(false);
  }, []);

  if (!orgId) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <p className="text-[13px] text-zinc-500">Select an organization</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <MapOfflineFallback className="h-full w-full" message="Map Offline" subtext="Check Mapbox configuration." />
      </div>
    );
  }

  return (
    <FeatureGate
      requiredTier="pro"
      featureTitle="God Mode Dispatch"
      featureDescription="Unlock real-time fleet tracking, road-snapped routing, and GPS footprint trails for your entire operation."
    >
    {/* ── PRD §4.1 Z-Index Registry ────────────────────────
         z-0:  Map canvas (Mapbox GL)
         z-10: Routes / Footprints (geographic overlays)
         z-20: Markers (Fleet & Job pins)
         z-30: Hover tooltips
         z-40: Floating widgets (Command Panel, Roster)
         z-50: Global navigation (handled by shell)
         z-60: Modals / Drawers (handled by shell)
         z-70: Toasts (handled by ActionToastContainer)
    ─────────────────────────────────────────────────────── */}
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      {/* Noise texture */}
      <div className="stealth-noise" />

      {/* ── z-45: Command Bar Header ───────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[45]">
        <div
          className="absolute inset-x-0 top-0 h-24"
          style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.7) 0%, rgba(5,5,5,0.3) 50%, transparent 100%)" }}
        />
        <div className="pointer-events-auto relative flex items-center justify-between px-5 py-3">
          <div className="flex flex-col">
            <span className="mb-0.5 font-mono text-[9px] font-medium tracking-[0.2em] text-emerald-500/60 uppercase">
              Live Dispatch
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight text-white">Fleet Command</h1>
              {dispatchPins.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  {dispatchPins.filter(p => p.status === "online" || p.status === "en_route" || p.status === "on_site").length} active
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/40 px-3 py-1.5 text-[11px] text-zinc-500 backdrop-blur-sm transition-colors hover:border-white/[0.1] hover:text-zinc-300"
            >
              Search fleet & jobs
              <kbd className="rounded bg-white/[0.04] px-1 py-0.5 font-mono text-[8px] text-zinc-600">⌘K</kbd>
            </button>
          </div>
        </div>
      </div>

      {/* ── z-0: Mapbox Canvas ─────────────────────────── */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 [&_.mapboxgl-ctrl-bottom-left]:hidden [&_.mapboxgl-ctrl-bottom-right_.mapboxgl-ctrl-attrib]:hidden [&_.mapboxgl-ctrl-logo]:hidden"
        style={{ background: "#050505" }}
      />

      {/* ── Map layers rendered via context ──────────── */}
      {mapReady && mapRef.current && (
        <DispatchMapProvider value={mapRef.current}>
          <RoutingLayer dispatchPins={dispatchPins} jobs={jobsWithCoords} visible={showActiveRoutes} />
          <FootprintsLayer trails={footprintsToRender} visible={showFootprints} />
          <FleetLayer
            techs={fleetTechs}
            visible={showFleet}
            hoveredId={hoveredTechId}
            onHover={setHoveredTechId}
            onHoverTechDetail={handleHoverTechDetail}
            rippleTechId={rippleTechId}
          />
          <JobLayer
            jobs={showUnassignedJobs ? jobMarkers : jobMarkers.filter((j) => j.variant !== "unassigned")}
            visible={jobMarkers.length > 0}
            onJobClick={handleJobClick}
          />
          <HoverDialog tech={hoverDialogTech} anchor={hoverAnchor} />
        </DispatchMapProvider>
      )}

      {/* ── z-40: Floating UI Widgets ───────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-40">
        {mapReady && mapRef.current && (
          <DispatchMapProvider value={mapRef.current}>
            <div className="pointer-events-auto absolute left-4 top-4">
              <DispatchCommandPanel
                showFleet={showFleet}
                showUnassignedJobs={showUnassignedJobs}
                showActiveRoutes={showActiveRoutes}
                showFootprints={showFootprints}
                onToggleFleet={() => setShowFleet((v) => !v)}
                onToggleUnassignedJobs={() => setShowUnassignedJobs((v) => !v)}
                onToggleActiveRoutes={() => setShowActiveRoutes((v) => !v)}
                onToggleFootprints={() => setShowFootprints((v) => !v)}
              />
            </div>
            <div className="pointer-events-auto absolute left-4 top-20" style={{ height: "calc(100vh - 6rem)" }}>
              <DispatchRoster
                pins={dispatchPins}
                hoveredTechId={hoveredTechId}
                onHoverTech={setHoveredTechId}
                onLocateTech={handleLocateTech}
                onOpenJobDossier={handleJobClick}
                onRippleTech={setRippleTechId}
                visible
              />
            </div>
          </DispatchMapProvider>
        )}
      </div>

      {/* ── z-35: Edge vignettes for command center depth ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[35] h-20" style={{ background: "linear-gradient(to top, rgba(5,5,5,0.5) 0%, transparent 100%)" }} />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-[35] w-8" style={{ background: "linear-gradient(to right, rgba(5,5,5,0.3) 0%, transparent 100%)" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[35] w-8" style={{ background: "linear-gradient(to left, rgba(5,5,5,0.3) 0%, transparent 100%)" }} />

      {/* z-60: Search modal overlay */}
      <DispatchSearch open={searchOpen} onClose={() => setSearchOpen(false)} onSearch={handleSearch} />

      {/* Zoom controls styling override */}
      <style jsx global>{`
        .mapboxgl-ctrl-group {
          background: rgba(9,9,11,0.8) !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
          backdrop-filter: blur(12px);
          border-radius: 8px !important;
          overflow: hidden;
        }
        .mapboxgl-ctrl-group button {
          width: 32px !important;
          height: 32px !important;
          background: transparent !important;
          border-color: rgba(255,255,255,0.04) !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background: rgba(255,255,255,0.04) !important;
        }
        .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon {
          filter: invert(1) brightness(0.5);
        }
        .mapboxgl-ctrl-group button:hover .mapboxgl-ctrl-icon {
          filter: invert(1) brightness(0.7);
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.15; transform: scale(1.3); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
    </FeatureGate>
  );
}
