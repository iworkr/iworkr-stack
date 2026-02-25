"use client";

import { Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { getLiveDispatch, getFootprintTrails, snapFootprintToRoads, type DispatchPin } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { useShellStore } from "@/lib/shell-store";
import { useFleetTracking } from "@/lib/hooks/use-fleet-tracking";
import { useGoogleMaps } from "@/components/maps/google-maps-provider";
import { OBSIDIAN_MAP_STYLES, DEFAULT_MAP_CENTER } from "@/components/maps/obsidian-map-styles";
import { MapOfflineFallback } from "@/components/maps/map-offline-fallback";
import { MapDevelopmentDetector } from "@/components/maps/map-development-detector";
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


function FitBoundsToData({
  techs,
  jobs,
}: {
  techs: DispatchPin[];
  jobs: JobMarkerData[];
}) {
  const map = useMap();
  const points = useMemo(() => {
    const out: { lat: number; lng: number }[] = [];
    techs.forEach((t) => {
      if (t.location_lat != null && t.location_lng != null) out.push({ lat: t.location_lat, lng: t.location_lng });
    });
    jobs.forEach((j) => out.push({ lat: j.lat, lng: j.lng }));
    return out;
  }, [techs, jobs]);

  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 50);
  }, [map, points]);
  return null;
}

export default function DispatchPage() {
  const { orgId } = useOrg();
  const { isLoaded, loadError } = useGoogleMaps();
  const openSlideOver = useShellStore((s) => s.openSlideOver);

  const [dispatchPins, setDispatchPins] = useState<DispatchPin[]>([]);
  const [footprints, setFootprints] = useState<FootprintTrail[]>([]);
  const [snappedFootprints, setSnappedFootprints] = useState<Map<string, google.maps.LatLngLiteral[]>>(new Map());
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
  const [developmentMode, setDevelopmentMode] = useState(false);

  const jobs = useJobsStore((s) => s.jobs);
  const loadFromServer = useJobsStore((s) => s.loadFromServer);

  useFleetTracking({ orgId, enabled: true });

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

  // Snap footprint trails to roads on-demand when footprints are visible (cache by techId)
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

  const handleLocateTech = useCallback((_techId: string, lat: number, lng: number) => {
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

  if (loadError || developmentMode) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <MapOfflineFallback
          className="h-full w-full"
          message="Map Offline"
          subtext={developmentMode ? "Enable billing in Google Cloud for this project to use Maps." : "Establishing link… or check API configuration."}
        />
      </div>
    );
  }

  return (
    <FeatureGate
      requiredTier="pro"
      featureTitle="God Mode Dispatch"
      featureDescription="Unlock real-time fleet tracking, road-snapped routing, and GPS footprint trails for your entire operation."
    >
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
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

      <DispatchSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={handleSearch}
      />

      <GoogleMap
        defaultCenter={DEFAULT_MAP_CENTER}
        defaultZoom={12}
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
        <FitBoundsToData techs={dispatchPins} jobs={jobMarkers} />

        <DispatchRoster
          pins={dispatchPins}
          hoveredTechId={hoveredTechId}
          onHoverTech={setHoveredTechId}
          onLocateTech={handleLocateTech}
          onOpenJobDossier={handleJobClick}
          onRippleTech={setRippleTechId}
          visible
        />

        <HoverDialog tech={hoverDialogTech} anchor={hoverAnchor} />

        <FleetLayer
          techs={fleetTechs}
          visible={showFleet}
          hoveredId={hoveredTechId}
          onHover={setHoveredTechId}
          onHoverTechDetail={handleHoverTechDetail}
          rippleTechId={rippleTechId}
        />
        <JobLayer
          jobs={
            showUnassignedJobs
              ? jobMarkers
              : jobMarkers.filter((j) => j.variant !== "unassigned")
          }
          visible={jobMarkers.length > 0}
          onJobClick={handleJobClick}
        />
        <RoutingLayer
          dispatchPins={dispatchPins}
          jobs={jobsWithCoords}
          visible={showActiveRoutes}
        />
        <FootprintsLayer trails={footprintsToRender} visible={showFootprints} />
      </GoogleMap>
    </div>
    </FeatureGate>
  );
}
