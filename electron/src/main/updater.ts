import { autoUpdater, UpdateCheckResult } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";
import log from "electron-log/main";
import { trackEvent } from "./analytics";

autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

export function initUpdater(win: BrowserWindow): void {
  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update…");
    win.webContents.send("update:checking");
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info.version);
    win.webContents.send("update:available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("App is up to date");
    win.webContents.send("update:not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    win.webContents.send("update:progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info.version);
    trackEvent("update_downloaded", { version: info.version });
    win.webContents.send("update:downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("error", (error) => {
    log.error("Auto-updater error:", error);
    win.webContents.send("update:error", error.message);
  });

  ipcMain.on("update:check", () => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error("Manual update check failed:", err);
    });
  });

  ipcMain.on("update:install", () => {
    log.info("User requested immediate update install");
    trackEvent("update_installed");
    autoUpdater.quitAndInstall(false, true);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn("Initial update check failed:", err.message);
    });
  }, 10_000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}
