"use client";

import { useState } from "react";

export type OperatingSystem = "mac" | "windows" | "linux" | "unknown";

function detectOperatingSystem(): OperatingSystem {
  if (typeof navigator === "undefined") return "unknown";

  const platform = (navigator.platform || "").toLowerCase();
  const userAgent = (navigator.userAgent || "").toLowerCase();

  if (platform.includes("mac") || userAgent.includes("mac")) return "mac";
  if (platform.includes("win") || userAgent.includes("windows")) return "windows";
  if (platform.includes("linux") || userAgent.includes("linux")) return "linux";
  return "unknown";
}

export function useOperatingSystem(): OperatingSystem {
  const [os] = useState<OperatingSystem>(() => detectOperatingSystem());
  return os;
}

