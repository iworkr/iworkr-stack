"use client";

import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

/**
 * Detects Google's "For development purposes only" watermark and notifies the parent.
 * When the API key has billing disabled or is in dev mode, Google injects an overlay.
 * We observe the map container and call onDevelopmentMode so the app can show a fallback instead.
 */
export function MapDevelopmentDetector({
  onDevelopmentMode,
}: {
  onDevelopmentMode: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const div = map.getDiv();
    if (!div) return;

    const check = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const text = (el.textContent || el.innerText || "").toLowerCase();
      if (text.includes("development purposes") || text.includes("this page can't load google maps")) {
        onDevelopmentMode();
      }
      el.childNodes.forEach(check);
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(check);
      }
    });

    observer.observe(div, { childList: true, subtree: true });
    check(div);

    return () => observer.disconnect();
  }, [map, onDevelopmentMode]);

  return null;
}
