/**
 * @layout app/site-render/[domain]/layout.tsx
 * @status STABLE
 * @description Layout — site-render/[domain]
 * @lastReview 2026-03-28
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: "index, follow",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
