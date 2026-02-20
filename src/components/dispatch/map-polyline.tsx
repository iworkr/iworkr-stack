"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

export interface MapPolylineProps {
  path: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  geodesic?: boolean;
  /** Optional symbols (e.g. arrow) repeated along the line. */
  icons?: google.maps.IconSequence[];
  zIndex?: number;
}

/** Renders a Polyline on the map using the Maps JavaScript API. Must be a child of Map. */
export function MapPolyline({
  path,
  strokeColor = "#71717a",
  strokeOpacity = 0.5,
  strokeWeight = 2,
  geodesic = true,
  icons,
  zIndex,
}: MapPolylineProps) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || path.length < 2) return;

    const polyline = new google.maps.Polyline({
      path,
      map,
      strokeColor,
      strokeOpacity,
      strokeWeight,
      geodesic,
      icons,
      zIndex,
    });
    polylineRef.current = polyline;
    return () => {
      polyline.setMap(null);
      polylineRef.current = null;
    };
  }, [map, path, strokeColor, strokeOpacity, strokeWeight, geodesic, icons, zIndex]);

  useEffect(() => {
    if (polylineRef.current && path.length >= 2) {
      polylineRef.current.setPath(path);
      const opts: { icons?: google.maps.IconSequence[]; zIndex?: number } = {};
      if (icons) opts.icons = icons;
      if (zIndex != null) opts.zIndex = zIndex;
      if (Object.keys(opts).length > 0) polylineRef.current.setOptions(opts);
    }
  }, [path, icons, zIndex]);

  return null;
}
