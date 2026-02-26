import { app, BrowserWindow, safeStorage, session } from "electron";
import path from "path";
import log from "electron-log/main";
import { createMainWindow, getMainWindow } from "./window";
import { registerIpcHandlers } from "./ipc";
import { initTray, destroyTray } from "./tray";
import { initUpdater } from "./updater";
import { registerProtocol, handleProtocolUrl } from "./protocol";
import { initMenu } from "./menu";
import { initAnalytics, trackEvent } from "./analytics";
import { initSentry } from "./sentry";
import Store from "electron-store";

const PROD_URL = "https://www.iworkrapp.com/dashboard";
const DEV_URL = "http://localhost:3000/dashboard";
const IS_DEV = !app.isPackaged;
const APP_URL = IS_DEV ? DEV_URL : PROD_URL;

// For the store encryption key, use safeStorage if available, otherwise generate from machine-specific data
const getEncryptionKey = () => {
  if (safeStorage.isEncryptionAvailable()) {
    // Use safeStorage to encrypt a known seed - this is machine-specific
    return safeStorage.encryptString('iworkr-store-key').toString('hex').slice(0, 32);
  }
  return undefined; // Fall back to no encryption in dev/unsupported environments
};

log.initialize();
initSentry();
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
  encryptionKey: IS_DEV ? undefined : getEncryptionKey(),
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
    const allowedHosts = ['iworkrapp.com', 'www.iworkrapp.com', 'localhost'];
    // Only modify headers for our own domains
    const url = new URL(details.url);
    if (!allowedHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

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
  initAnalytics();

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
