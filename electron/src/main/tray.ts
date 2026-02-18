import { Tray, Menu, BrowserWindow, app, nativeImage } from "electron";
import path from "path";
import log from "electron-log/main";

let tray: Tray | null = null;

export function initTray(win: BrowserWindow): void {
  const iconPath = path.join(__dirname, "..", "..", "resources", "tray-iconTemplate.png");

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error("Icon file empty");
  } catch {
    icon = nativeImage.createEmpty();
    log.warn("Tray icon not found, using empty icon. Place tray-iconTemplate.png in resources/");
  }

  tray = new Tray(icon);
  tray.setToolTip("iWorkr");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Status: Online",
      enabled: false,
      icon: createStatusDot("#00E676"),
    },
    { type: "separator" },
    {
      label: "Open iWorkr",
      click: () => {
        win.show();
        win.focus();
      },
    },
    {
      label: "New Job",
      click: () => {
        win.show();
        win.focus();
        win.webContents.send("navigate", "/dashboard/jobs?action=new");
      },
    },
    { type: "separator" },
    {
      label: `Version ${app.getVersion()}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Quit iWorkr",
      role: "quit",
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
    }
  });

  log.info("System tray initialized");
}

export function updateTrayStatus(online: boolean): void {
  if (!tray) return;
  tray.setToolTip(online ? "iWorkr — Online" : "iWorkr — Offline");
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function createStatusDot(color: string): Electron.NativeImage {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">
      <circle cx="6" cy="6" r="4" fill="${color}"/>
    </svg>
  `;
  return nativeImage.createFromBuffer(Buffer.from(svg));
}
