"use client";

import { useEffect } from "react";
import { useDesktop } from "./use-desktop";
import { useInboxStore } from "@/lib/inbox-store";

export function DesktopBadge() {
  const { isDesktop, updateBadge } = useDesktop();
  const unreadCount = useInboxStore((s) =>
    s.items.filter((i) => !i.read && !i.archived).length
  );

  useEffect(() => {
    if (!isDesktop) return;
    updateBadge(unreadCount);
  }, [isDesktop, unreadCount, updateBadge]);

  return null;
}
