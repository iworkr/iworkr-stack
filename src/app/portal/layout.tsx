import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iWorkr — Family & Participant Portal",
  description: "Live roster, budget telemetry, care updates, and secure signatures.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
