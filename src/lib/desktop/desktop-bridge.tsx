"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDesktop } from "./use-desktop";

export function DesktopBridge() {
  const { isDesktop, api } = useDesktop();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isDesktop || !api) return;

    const unsubNavigate = api.onNavigate((route) => {
      router.push(route);
    });

    const unsubShortcut = api.onShortcut((action) => {
      if (action === "command-menu") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      } else if (action === "keyboard-help") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
      }
    });

    return () => {
      unsubNavigate();
      unsubShortcut();
    };
  }, [isDesktop, api, router]);

  useEffect(() => {
    if (!isDesktop || !api) return;

    const handleOnline = () => api.network.reportStatus(true);
    const handleOffline = () => api.network.reportStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    api.network.reportStatus(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isDesktop, api]);

  return null;
}
