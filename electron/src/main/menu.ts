import { Menu, BrowserWindow, app, shell } from "electron";

const IS_MAC = process.platform === "darwin";

export function initMenu(win: BrowserWindow): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(IS_MAC
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Preferences…",
                accelerator: "CmdOrCtrl+,",
                click: () => {
                  win.show();
                  win.webContents.send("navigate", "/settings/preferences");
                },
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" as const }]),
        { type: "separator" as const },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" as const },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Navigate",
      submenu: [
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => win.webContents.send("navigate", "/dashboard"),
        },
        {
          label: "Jobs",
          accelerator: "CmdOrCtrl+2",
          click: () => win.webContents.send("navigate", "/dashboard/jobs"),
        },
        {
          label: "Schedule",
          accelerator: "CmdOrCtrl+3",
          click: () => win.webContents.send("navigate", "/dashboard/schedule"),
        },
        {
          label: "Inbox",
          accelerator: "CmdOrCtrl+4",
          click: () => win.webContents.send("navigate", "/dashboard/inbox"),
        },
        { type: "separator" },
        {
          label: "Command Menu",
          accelerator: "CmdOrCtrl+K",
          click: () => win.webContents.send("shortcut", "command-menu"),
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(IS_MAC
          ? [
              { type: "separator" as const },
              { role: "front" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "iWorkr Help Center",
          click: () => shell.openExternal("https://iworkrapp.com/help"),
        },
        {
          label: "Keyboard Shortcuts",
          accelerator: "CmdOrCtrl+/",
          click: () => win.webContents.send("shortcut", "keyboard-help"),
        },
        { type: "separator" },
        {
          label: "Report Issue",
          click: () => shell.openExternal("https://iworkrapp.com/changelog"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
