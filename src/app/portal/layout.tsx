import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iWorkr — Secure Document Portal",
  description: "View, approve, and pay documents securely.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
