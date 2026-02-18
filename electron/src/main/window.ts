import { BrowserWindow, shell } from "electron";
import path from "path";
import log from "electron-log/main";
import { store } from "./main";

const IS_MAC = process.platform === "darwin";
const VANTABLACK = "#050505";
const SHELL_PATH = path.join(__dirname, "..", "..", "renderer", "shell.html");
const PRELOAD_PATH = path.join(__dirname, "..", "preload", "preload.js");

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(appUrl: string): BrowserWindow {
  const savedBounds = store.get("window.bounds");
  const wasMaximized = store.get("window.maximized");

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1440,
    height: savedBounds?.height ?? 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: IS_MAC ? "hiddenInset" : "hidden",
    titleBarOverlay: IS_MAC
      ? false
      : {
          color: VANTABLACK,
          symbolColor: "#a1a1aa",
          height: 36,
        },
    trafficLightPosition: IS_MAC ? { x: 16, y: 14 } : undefined,
    backgroundColor: VANTABLACK,
    vibrancy: IS_MAC ? "under-window" : undefined,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
      devTools: !require("electron").app.isPackaged,
    },
  });

  mainWindow.loadFile(SHELL_PATH);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("shell:loading", { url: appUrl });

    setTimeout(() => {
      mainWindow?.loadURL(appUrl).catch((err) => {
        log.warn("Failed to load remote URL, staying on local shell:", err.message);
        mainWindow?.webContents.send("shell:offline");
      });
    }, 100);
  });

  mainWindow.webContents.on("did-navigate", () => {
    mainWindow?.webContents.send("shell:ready");
  });

  mainWindow.once("ready-to-show", () => {
    if (wasMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
  });

  mainWindow.on("close", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set("window.bounds", mainWindow.getBounds());
      store.set("window.maximized", mainWindow.isMaximized());
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // Aborted navigations (expected during redirect)
    log.warn(`Page failed to load: ${errorCode} ${errorDescription}`);
    mainWindow?.webContents.send("shell:offline");
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("iworkr://")) {
      return { action: "deny" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  return mainWindow;
}
