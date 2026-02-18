import { app, BrowserWindow, session } from "electron";
import path from "path";
import log from "electron-log/main";
import { createMainWindow, getMainWindow } from "./window";
import { registerIpcHandlers } from "./ipc";
import { initTray, destroyTray } from "./tray";
import { initUpdater } from "./updater";
import { registerProtocol, handleProtocolUrl } from "./protocol";
import { initMenu } from "./menu";
import Store from "electron-store";

const APP_URL = "https://iworkrapp.com/dashboard";
const IS_DEV = !app.isPackaged;

log.initialize();
log.info("iWorkr Desktop starting…", { version: app.getVersion() });

export const store = new Store<{
  "auth.token": string | null;
  "auth.refreshToken": string | null;
  "window.bounds": Electron.Rectangle | null;
  "window.maximized": boolean;
  "prefs.updateChannel": "latest" | "beta";
  "prefs.launchAtLogin": boolean;
}>({
  defaults: {
    "auth.token": null,
    "auth.refreshToken": null,
    "window.bounds": null,
    "window.maximized": false,
    "prefs.updateChannel": "latest",
    "prefs.launchAtLogin": false,
  },
  encryptionKey: IS_DEV ? undefined : "iworkr-desktop-v1",
});

let deepLinkUrl: string | null = null;

registerProtocol();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", (_event, argv) => {
  const win = getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  const url = argv.find((a) => a.startsWith("iworkr://"));
  if (url) handleProtocolUrl(url);
});

app.on("open-url", (_event, url) => {
  if (app.isReady()) {
    handleProtocolUrl(url);
  } else {
    deepLinkUrl = url;
  }
});

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers["x-frame-options"];
    delete headers["X-Frame-Options"];

    const csp = headers["content-security-policy"] || headers["Content-Security-Policy"];
    if (csp) {
      const key = headers["content-security-policy"] ? "content-security-policy" : "Content-Security-Policy";
      headers[key] = csp.map((v) =>
        v.replace(/frame-ancestors\s+'none'/gi, "frame-ancestors 'self'")
      );
    }

    callback({ responseHeaders: headers });
  });

  const win = createMainWindow(APP_URL);

  registerIpcHandlers(win);
  initMenu(win);
  initTray(win);

  if (!IS_DEV) {
    initUpdater(win);
  }

  if (deepLinkUrl) {
    handleProtocolUrl(deepLinkUrl);
    deepLinkUrl = null;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(APP_URL);
    } else {
      win.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    destroyTray();
    app.quit();
  }
});

app.on("before-quit", () => {
  destroyTray();
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught exception in main process:", error);
});
