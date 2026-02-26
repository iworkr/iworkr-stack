import { ipcMain, BrowserWindow, app, Notification, nativeImage } from "electron";
import path from "path";
import log from "electron-log/main";
import { store } from "./main";

const IS_MAC = process.platform === "darwin";

export function registerIpcHandlers(win: BrowserWindow): void {
  // ── Badge Count ─────────────────────────────────────────
  ipcMain.on("badge:update", (_event, count: number) => {
    if (IS_MAC) {
      app.dock?.setBadge(count > 0 ? String(count) : "");
    } else {
      win.setOverlayIcon(
        count > 0 ? createBadgeIcon(count) : null,
        count > 0 ? `${count} unread` : ""
      );
    }
    log.info(`Badge updated: ${count}`);
  });

  // ── Native Notifications ────────────────────────────────
  ipcMain.on("notification:send", (_event, payload: {
    title: string;
    body: string;
    route?: string;
    urgency?: "low" | "normal" | "critical";
  }) => {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      icon: path.join(__dirname, "..", "..", "resources", "icon.png"),
      urgency: payload.urgency ?? "normal",
      silent: false,
    });

    notification.on("click", () => {
      win.show();
      win.focus();
      if (payload.route) {
        win.webContents.send("navigate", payload.route);
      }
    });

    notification.show();
  });

  // ── Auth Token Storage ──────────────────────────────────
  ipcMain.handle("auth:store-token", async (_event, token: string, refreshToken?: string) => {
    store.set("auth.token", token);
    if (refreshToken) store.set("auth.refreshToken", refreshToken);
    log.info("Auth token stored securely");
    return true;
  });

  ipcMain.handle("auth:get-token", async () => {
    return {
      token: store.get("auth.token"),
      refreshToken: store.get("auth.refreshToken"),
    };
  });

  ipcMain.handle("auth:clear-token", async () => {
    store.delete("auth.token");
    store.delete("auth.refreshToken");
    log.info("Auth tokens cleared");
    return true;
  });

  // ── App Info ────────────────────────────────────────────
  ipcMain.handle("app:info", async () => ({
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    locale: app.getLocale(),
  }));

  // ── Window Controls ─────────────────────────────────────
  ipcMain.on("window:minimize", () => win.minimize());
  ipcMain.on("window:maximize", () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on("window:close", () => win.close());

  ipcMain.handle("window:is-maximized", () => win.isMaximized());

  win.on("maximize", () => win.webContents.send("window:maximized", true));
  win.on("unmaximize", () => win.webContents.send("window:maximized", false));

  // ── Focus & Visibility ──────────────────────────────────
  ipcMain.on("window:focus", () => {
    win.show();
    win.focus();
  });

  // ── Preferences ─────────────────────────────────────────
  ipcMain.handle("prefs:get", async (_event, key: string) => {
    return store.get(key as keyof typeof store.store);
  });

  const ALLOWED_PREF_KEYS = ['theme', 'language', 'notifications', 'autoUpdate', 'minimizeToTray', 'startMinimized'];

  ipcMain.handle("prefs:set", async (_event, key: string, value: unknown) => {
    if (!ALLOWED_PREF_KEYS.includes(key)) {
      throw new Error(`Setting preference key "${key}" is not allowed`);
    }
    store.set(`prefs.${key}`, value);
    return true;
  });

  // ── Online/Offline ──────────────────────────────────────
  ipcMain.on("network:status", (_event, isOnline: boolean) => {
    log.info(`Network status: ${isOnline ? "online" : "offline"}`);
  });
}

function createBadgeIcon(count: number): Electron.NativeImage {
  const size = 16;
  const canvas = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ef4444"/>
      <text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" 
            font-family="Arial" font-size="10" font-weight="bold" fill="white">
        ${count > 9 ? "9+" : count}
      </text>
    </svg>
  `;
  // NOTE: SVG support in nativeImage is unreliable on some platforms. Consider using a pre-rendered PNG.
  return nativeImage.createFromBuffer(
    Buffer.from(canvas)
  );
}
