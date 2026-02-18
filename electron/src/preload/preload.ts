import { contextBridge, ipcRenderer } from "electron";

const api = {
  // ── Badge ─────────────────────────────────────────────
  badge: {
    update: (count: number) => ipcRenderer.send("badge:update", count),
  },

  // ── Notifications ─────────────────────────────────────
  notification: {
    send: (payload: {
      title: string;
      body: string;
      route?: string;
      urgency?: "low" | "normal" | "critical";
    }) => ipcRenderer.send("notification:send", payload),
  },

  // ── Auth ──────────────────────────────────────────────
  auth: {
    storeToken: (token: string, refreshToken?: string): Promise<boolean> =>
      ipcRenderer.invoke("auth:store-token", token, refreshToken),
    getToken: (): Promise<{ token: string | null; refreshToken: string | null }> =>
      ipcRenderer.invoke("auth:get-token"),
    clearToken: (): Promise<boolean> =>
      ipcRenderer.invoke("auth:clear-token"),
    onAuthenticated: (callback: (data: { token: string; refreshToken?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { token: string; refreshToken?: string }) => callback(data);
      ipcRenderer.on("auth:authenticated", handler);
      return () => ipcRenderer.removeListener("auth:authenticated", handler);
    },
  },

  // ── App ───────────────────────────────────────────────
  app: {
    info: (): Promise<{
      version: string;
      name: string;
      platform: string;
      arch: string;
      isPackaged: boolean;
      locale: string;
    }> => ipcRenderer.invoke("app:info"),
    isDesktop: true as const,
  },

  // ── Window Controls ───────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
    focus: () => ipcRenderer.send("window:focus"),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChange: (callback: (maximized: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
      ipcRenderer.on("window:maximized", handler);
      return () => ipcRenderer.removeListener("window:maximized", handler);
    },
  },

  // ── Navigation (from main process) ────────────────────
  onNavigate: (callback: (route: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, route: string) => callback(route);
    ipcRenderer.on("navigate", handler);
    return () => ipcRenderer.removeListener("navigate", handler);
  },

  onShortcut: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on("shortcut", handler);
    return () => ipcRenderer.removeListener("shortcut", handler);
  },

  // ── Shell Events ──────────────────────────────────────
  shell: {
    onLoading: (callback: (data: { url: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { url: string }) => callback(data);
      ipcRenderer.on("shell:loading", handler);
      return () => ipcRenderer.removeListener("shell:loading", handler);
    },
    onReady: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("shell:ready", handler);
      return () => ipcRenderer.removeListener("shell:ready", handler);
    },
    onOffline: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("shell:offline", handler);
      return () => ipcRenderer.removeListener("shell:offline", handler);
    },
  },

  // ── Updates ───────────────────────────────────────────
  update: {
    check: () => ipcRenderer.send("update:check"),
    install: () => ipcRenderer.send("update:install"),
    onChecking: (cb: () => void) => {
      ipcRenderer.on("update:checking", cb);
      return () => ipcRenderer.removeListener("update:checking", cb);
    },
    onAvailable: (cb: (info: { version: string; releaseDate: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, info: { version: string; releaseDate: string }) => cb(info);
      ipcRenderer.on("update:available", handler);
      return () => ipcRenderer.removeListener("update:available", handler);
    },
    onProgress: (cb: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, p: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => cb(p);
      ipcRenderer.on("update:progress", handler);
      return () => ipcRenderer.removeListener("update:progress", handler);
    },
    onDownloaded: (cb: (info: { version: string; releaseDate: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, info: { version: string; releaseDate: string }) => cb(info);
      ipcRenderer.on("update:downloaded", handler);
      return () => ipcRenderer.removeListener("update:downloaded", handler);
    },
    onError: (cb: (message: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg);
      ipcRenderer.on("update:error", handler);
      return () => ipcRenderer.removeListener("update:error", handler);
    },
  },

  // ── Preferences ───────────────────────────────────────
  prefs: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke("prefs:get", key),
    set: (key: string, value: unknown): Promise<boolean> => ipcRenderer.invoke("prefs:set", key, value),
  },

  // ── Network ───────────────────────────────────────────
  network: {
    reportStatus: (isOnline: boolean) => ipcRenderer.send("network:status", isOnline),
  },

  // ── Analytics ──────────────────────────────────────────
  analytics: {
    track: (event: string, properties?: Record<string, unknown>) =>
      ipcRenderer.send("analytics:track", event, properties),
  },
};

contextBridge.exposeInMainWorld("iworkr", api);

export type IWorkrAPI = typeof api;
