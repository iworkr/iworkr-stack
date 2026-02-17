"use client";

import type { ReactNode } from "react";
import { FeatureGate } from "@/components/monetization/feature-gate";

export default function AutomationsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate feature="automations">{children}</FeatureGate>;
}
