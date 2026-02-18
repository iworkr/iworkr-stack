export interface IWorkrAPI {
  badge: {
    update: (count: number) => void;
  };
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
    onAuthenticated: (callback: (data: { token: string; refreshToken?: string }) => void) => () => void;
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
    onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  };
  onNavigate: (callback: (route: string) => void) => () => void;
  onShortcut: (callback: (action: string) => void) => () => void;
  shell: {
    onLoading: (callback: (data: { url: string }) => void) => () => void;
    onReady: (callback: () => void) => () => void;
    onOffline: (callback: () => void) => () => void;
  };
  update: {
    check: () => void;
    install: () => void;
    onChecking: (cb: () => void) => () => void;
    onAvailable: (cb: (info: { version: string; releaseDate: string }) => void) => () => void;
    onProgress: (cb: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void;
    onDownloaded: (cb: (info: { version: string; releaseDate: string }) => void) => () => void;
    onError: (cb: (message: string) => void) => () => void;
  };
  prefs: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<boolean>;
  };
  network: {
    reportStatus: (isOnline: boolean) => void;
  };
}

declare global {
  interface Window {
    iworkr?: IWorkrAPI;
  }
}
