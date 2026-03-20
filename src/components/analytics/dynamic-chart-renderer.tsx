"use client";

import dynamic from "next/dynamic";

const BarChart = dynamic(
  () => import("@tremor/react").then((m) => ({ default: m.BarChart })),
  { ssr: false, loading: () => <div className="h-64 rounded-xl bg-white/[0.04] animate-pulse" /> },
);

const LineChart = dynamic(
  () => import("@tremor/react").then((m) => ({ default: m.LineChart })),
  { ssr: false, loading: () => <div className="h-64 rounded-xl bg-white/[0.04] animate-pulse" /> },
);

const DonutChart = dynamic(
  () => import("@tremor/react").then((m) => ({ default: m.DonutChart })),
  { ssr: false, loading: () => <div className="h-64 rounded-xl bg-white/[0.04] animate-pulse" /> },
);

export { BarChart, LineChart, DonutChart };
