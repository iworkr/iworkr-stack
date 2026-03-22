/**
 * @layout IntegrationsLayout
 * @status COMPLETE
 * @description Feature-gated wrapper for the integrations section
 * @lastAudit 2026-03-22
 */
"use client";

import type { ReactNode } from "react";
import { FeatureGate } from "@/components/monetization/feature-gate";

export default function IntegrationsLayout({ children }: { children: ReactNode }) {
  return <FeatureGate feature="integrations">{children}</FeatureGate>;
}
