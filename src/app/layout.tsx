import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "iWorkr — The Operating System for Service Work",
    template: "%s | iWorkr",
  },
  description:
    "Purpose-built for plumbers, electricians, and field teams. Manage jobs, scheduling, and payments with engineering precision.",
  keywords: [
    "field service management",
    "plumber software",
    "electrician scheduling",
    "job management",
    "service work",
    "invoicing",
    "team scheduling",
    "work orders",
  ],
  authors: [{ name: "iWorkr" }],
  creator: "iWorkr",
  openGraph: {
    title: "iWorkr — The Operating System for Service Work",
    description:
      "Purpose-built for plumbers, electricians, and field teams. Manage jobs, scheduling, and payments with engineering precision.",
    url: siteUrl,
    siteName: "iWorkr",
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: "iWorkr — The Operating System for Service Work",
    description:
      "Purpose-built for plumbers, electricians, and field teams. Manage jobs, scheduling, and payments with engineering precision.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-black text-zinc-100`}
      >
        {/* Noise grain overlay */}
        <div
          className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
