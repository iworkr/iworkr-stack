import { app } from "electron";
import path from "path";
import log from "electron-log/main";
import { getMainWindow } from "./window";
import { store } from "./main";

const PROTOCOL = "iworkr";

export function registerProtocol(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  log.info(`Protocol handler registered: ${PROTOCOL}://`);
}

export function handleProtocolUrl(url: string): void {
  log.info("Protocol URL received:", url);

  try {
    const parsed = new URL(url);
    const pathname = parsed.hostname + parsed.pathname;

    if (pathname.startsWith("auth/callback")) {
      handleAuthCallback(parsed);
      return;
    }

    const win = getMainWindow();
    if (win) {
      win.show();
      win.focus();

      const webRoute = `/${pathname}${parsed.search}`;
      win.webContents.send("navigate", webRoute);
    }
  } catch (err) {
    log.error("Failed to parse protocol URL:", err);
  }
}

function handleAuthCallback(parsed: URL): void {
  const token = parsed.searchParams.get("token");
  const refreshToken = parsed.searchParams.get("refresh_token");

  if (!token) {
    log.error("Auth callback received without token");
    return;
  }

  store.set("auth.token", token);
  if (refreshToken) store.set("auth.refreshToken", refreshToken);

  log.info("Auth tokens captured from protocol callback");

  const win = getMainWindow();
  if (win) {
    win.show();
    win.focus();
    win.webContents.send("auth:authenticated", { token, refreshToken });
    const { app } = require("electron");
    const dashboardUrl = app.isPackaged
      ? "https://www.iworkrapp.com/dashboard"
      : "http://localhost:3000/dashboard";
    win.loadURL(dashboardUrl).catch((err: Error) => {
      log.error("Failed to reload after auth:", err);
    });
  }
}
