"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { updateFleetPosition } from "@/app/actions/dashboard";

const POSITION_INTERVAL_MS = 15_000;

interface FleetTrackingOptions {
  orgId: string | null;
  enabled?: boolean;
}

export function useFleetTracking({ orgId, enabled = true }: FleetTrackingOptions) {
  const [tracking, setTracking] = useState(false);
  const [lastPosition, setLastPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);

  const sendPosition = useCallback(
    async (pos: GeolocationPosition) => {
      if (!orgId) return;
      const { latitude, longitude, heading, speed, accuracy } = pos.coords;

      const last = lastSentRef.current;
      if (last) {
        const dist = Math.hypot(latitude - last.lat, longitude - last.lng) * 111_139;
        const elapsed = Date.now() - last.ts;
        if (dist < 5 && elapsed < POSITION_INTERVAL_MS) return;
      }

      lastSentRef.current = { lat: latitude, lng: longitude, ts: Date.now() };

      const derivedStatus =
        speed != null && speed > 2 ? "driving" : "idle";

      await updateFleetPosition(orgId, latitude, longitude, {
        heading: heading ?? undefined,
        speed: speed != null ? Math.round(speed * 3.6) : undefined,
        accuracy: accuracy ?? undefined,
        status: derivedStatus,
      });
    },
    [orgId]
  );

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setError(null);
    setTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLastPosition(pos);
        sendPosition(pos);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      }
    );

    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLastPosition(pos);
          sendPosition(pos);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 }
      );
    }, POSITION_INTERVAL_MS);
  }, [sendPosition]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTracking(false);
    lastSentRef.current = null;
  }, []);

  useEffect(() => {
    if (enabled && orgId) {
      startTracking();
    }
    return () => stopTracking();
  }, [enabled, orgId, startTracking, stopTracking]);

  return { tracking, lastPosition, error, startTracking, stopTracking };
}
