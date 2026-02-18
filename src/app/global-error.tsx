"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body style={{ background: "#050505", color: "#ededed", fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: 56, height: 56, margin: "0 auto 24px",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 16, border: "1px solid rgba(244,63,94,0.15)", background: "rgba(244,63,94,0.05)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" /><path d="M12 17h.01" />
              </svg>
            </div>

            <p style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em", color: "#52525b", textTransform: "uppercase", marginBottom: 8 }}>
              Critical System Error
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#fafafa", margin: "0 0 12px" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 13, color: "#71717a", lineHeight: 1.6, maxWidth: 320, margin: "0 auto 32px" }}>
              A critical error occurred. Our systems have been notified.
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 12,
                  background: "#059669", color: "white",
                  fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <a
                href="/dashboard"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 12,
                  background: "rgba(255,255,255,0.03)", color: "#d4d4d8",
                  fontSize: 13, fontWeight: 500, border: "1px solid rgba(255,255,255,0.08)",
                  textDecoration: "none",
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
