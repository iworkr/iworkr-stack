/**
 * @layout AutomationsLayout
 * @status COMPLETE
 * @description Feature-gated wrapper for the automations section
 * @lastAudit 2026-03-22
 */
"use client";

import type { ReactNode } from "react";
import { FeatureGate } from "@/components/monetization/feature-gate";

export default function AutomationsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate feature="automations">{children}</FeatureGate>;
}
