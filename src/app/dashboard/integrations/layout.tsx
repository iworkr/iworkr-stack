"use client";

import type { ReactNode } from "react";
import { FeatureGate } from "@/components/monetization/feature-gate";

export default function IntegrationsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate feature="integrations">{children}</FeatureGate>;
}
