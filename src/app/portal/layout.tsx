/**
 * @layout PortalLayout
 * @status COMPLETE
 * @description Family & participant portal layout with metadata for care access
 * @lastAudit 2026-03-22
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iWorkr — Family & Participant Portal",
  description: "Live roster, budget telemetry, care updates, and secure signatures.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
