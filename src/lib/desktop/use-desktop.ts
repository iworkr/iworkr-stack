"use client";

import { useEffect, useState, useCallback } from "react";

interface IWorkrDesktopAPI {
  badge: { update: (count: number) => void };
  notification: {
    send: (payload: {
      title: string;
      body: string;
      route?: string;
      urgency?: "low" | "normal" | "critical";
    }) => void;
  };
  auth: {
    storeToken: (token: string, refreshToken?: string) => Promise<boolean>;
    getToken: () => Promise<{ token: string | null; refreshToken: string | null }>;
    clearToken: () => Promise<boolean>;
    onAuthenticated: (cb: (data: { token: string; refreshToken?: string }) => void) => () => void;
  };
  app: {
    info: () => Promise<{
      version: string;
      name: string;
      platform: string;
      arch: string;
      isPackaged: boolean;
      locale: string;
    }>;
    isDesktop: true;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    focus: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
  };
  onNavigate: (cb: (route: string) => void) => () => void;
  onShortcut: (cb: (action: string) => void) => () => void;
  update: {
    check: () => void;
    install: () => void;
    onDownloaded: (cb: (info: { version: string; releaseDate: string }) => void) => () => void;
  };
  prefs: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
  };
  network: {
    reportStatus: (isOnline: boolean) => void;
  };
}

function getDesktopAPI(): IWorkrDesktopAPI | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { iworkr?: IWorkrDesktopAPI }).iworkr ?? null;
}

export function useDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [api, setApi] = useState<IWorkrDesktopAPI | null>(null);

  useEffect(() => {
    const desktopApi = getDesktopAPI();
    if (desktopApi) {
      setIsDesktop(true);
      setApi(desktopApi);
    }
  }, []);

  const updateBadge = useCallback(
    (count: number) => {
      api?.badge.update(count);
    },
    [api]
  );

  const sendNotification = useCallback(
    (payload: {
      title: string;
      body: string;
      route?: string;
      urgency?: "low" | "normal" | "critical";
    }) => {
      api?.notification.send(payload);
    },
    [api]
  );

  return {
    isDesktop,
    api,
    updateBadge,
    sendNotification,
  };
}

export function isDesktopApp(): boolean {
  return getDesktopAPI() !== null;
}
