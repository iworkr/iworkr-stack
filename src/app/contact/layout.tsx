/**
 * @layout ContactLayout
 * @status COMPLETE
 * @description Contact page layout with metadata for support and enterprise enquiries
 * @lastAudit 2026-03-22
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the iWorkr team. Submit a support request, report a bug, or ask about enterprise plans.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
