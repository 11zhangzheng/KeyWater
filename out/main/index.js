import { app, ipcMain, globalShortcut, BrowserWindow, screen } from "electron";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const APP_NAME = "HydraBit";
const userDataRoot = join(app.getPath("appData"), APP_NAME);
const sessionDataRoot = join(userDataRoot, "session");
const diskCacheRoot = join(sessionDataRoot, "cache");
app.setName(APP_NAME);
mkdirSync(diskCacheRoot, { recursive: true });
app.setPath("userData", userDataRoot);
app.setPath("sessionData", sessionDataRoot);
app.commandLine.appendSwitch("disk-cache-dir", diskCacheRoot);
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
const DEFAULT_SETTINGS = {
  keyThreshold: 2e3,
  sipAmountMl: 250,
  enableSupplements: false,
  paused: false
};
let widgetWindow = null;
let hudWindow = null;
let state;
let saveTimer = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const todayKey = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const defaultDailyStats = () => ({
  date: todayKey(),
  waterCount: 0,
  waterMl: 0,
  keyCount: 0,
  supplements: []
});
const getStorePath = () => join(app.getPath("userData"), "hydrabit-state.json");
const getPreloadPath = () => join(__dirname, "../preload/index.mjs");
const readState = () => {
  const fallback = {
    settings: DEFAULT_SETTINGS,
    dailyStats: defaultDailyStats(),
    thirsty: false,
    keyboardTracker: "disabled"
  };
  try {
    const storePath = getStorePath();
    if (!existsSync(storePath)) return fallback;
    const parsed = JSON.parse(readFileSync(storePath, "utf8"));
    const dailyStats = parsed.dailyStats?.date === todayKey() ? parsed.dailyStats : defaultDailyStats();
    return {
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      dailyStats,
      thirsty: (dailyStats.keyCount ?? 0) >= (parsed.settings?.keyThreshold ?? DEFAULT_SETTINGS.keyThreshold),
      keyboardTracker: "disabled",
      widgetBounds: parsed.widgetBounds
    };
  } catch (error) {
    console.error("[HydraBit] Failed to read local state:", error);
    return fallback;
  }
};
const writeState = () => {
  if (!state) return;
  try {
    const storePath = getStorePath();
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    console.error("[HydraBit] Failed to write local state:", error);
  }
};
const persistSoon = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeState, 150);
};
const resetIfNewDay = () => {
  if (state.dailyStats.date !== todayKey()) {
    state.dailyStats = defaultDailyStats();
    state.thirsty = false;
  }
};
const publishState = () => {
  resetIfNewDay();
  widgetWindow?.webContents.send("hydrabit:state", state);
  hudWindow?.webContents.send("hydrabit:state", state);
  persistSoon();
};
const incrementKeyCount = () => {
  resetIfNewDay();
  if (state.settings.paused) return;
  state.dailyStats.keyCount += 1;
  state.thirsty = state.dailyStats.keyCount >= state.settings.keyThreshold;
  publishState();
};
const confirmWater = () => {
  resetIfNewDay();
  state.dailyStats.waterCount += 1;
  state.dailyStats.waterMl += state.settings.sipAmountMl;
  state.dailyStats.keyCount = 0;
  state.thirsty = false;
  publishState();
  return state;
};
const closeHudWindow = () => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close();
  }
};
const confirmWaterFromHud = () => {
  const nextState = confirmWater();
  closeHudWindow();
  widgetWindow?.showInactive();
  return nextState;
};
const boundsFitDisplay = (bounds) => {
  return screen.getAllDisplays().some(({ workArea }) => {
    const horizontalOverlap = bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x;
    const verticalOverlap = bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y;
    return horizontalOverlap && verticalOverlap;
  });
};
const getInitialWidgetBounds = (width, height) => {
  if (state.widgetBounds && boundsFitDisplay(state.widgetBounds)) {
    return { ...state.widgetBounds, width, height };
  }
  const { workArea } = screen.getPrimaryDisplay();
  return {
    width,
    height,
    x: Math.round(workArea.x + workArea.width - width - 18),
    y: Math.round(workArea.y + workArea.height - height - 18)
  };
};
const rememberWidgetBounds = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  state.widgetBounds = widgetWindow.getBounds();
  persistSoon();
};
const createWidgetWindow = () => {
  const width = 280;
  const height = 232;
  const bounds = getInitialWidgetBounds(width, height);
  widgetWindow = new BrowserWindow({
    width,
    height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widgetWindow.on("moved", rememberWidgetBounds);
  if (process.env.ELECTRON_RENDERER_URL) {
    widgetWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    widgetWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
};
const createHudWindow = () => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.show();
    hudWindow.focus();
    return;
  }
  const { workArea } = screen.getPrimaryDisplay();
  const width = 420;
  const height = 260;
  hudWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  hudWindow.setAlwaysOnTop(true, "screen-saver");
  hudWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "Enter") {
      event.preventDefault();
      confirmWaterFromHud();
    }
    if (input.key === "Escape") {
      event.preventDefault();
      closeHudWindow();
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    hudWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?hud=1`);
  } else {
    hudWindow.loadFile(join(__dirname, "../renderer/index.html"), { query: { hud: "1" } });
  }
  hudWindow.once("ready-to-show", () => {
    hudWindow?.webContents.send("hydrabit:state", state);
    hudWindow?.show();
    hudWindow?.focus();
  });
  hudWindow.on("closed", () => {
    hudWindow = null;
  });
};
const registerHotkeys = () => {
  const registered = globalShortcut.register("CommandOrControl+Shift+W", () => {
    createHudWindow();
  });
  if (!registered) {
    console.warn("[HydraBit] Failed to register global hotkey: CommandOrControl+Shift+W");
  }
};
const startKeyboardActivityTracker = async () => {
  try {
    const hookModule = await import("uiohook-napi");
    const hook = hookModule.uIOhook;
    hook.on("keydown", incrementKeyCount);
    hook.start();
    state.keyboardTracker = "global";
  } catch (error) {
    console.warn("[HydraBit] Global keyboard tracker unavailable, using window fallback:", error);
    state.keyboardTracker = "window-fallback";
  }
  publishState();
};
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    widgetWindow?.showInactive();
    widgetWindow?.moveTop();
  });
  app.whenReady().then(async () => {
    state = readState();
    createWidgetWindow();
    registerHotkeys();
    await startKeyboardActivityTracker();
    ipcMain.handle("hydrabit:get-state", () => {
      resetIfNewDay();
      return state;
    });
    ipcMain.handle("hydrabit:update-settings", (_event, updates) => {
      state.settings = {
        ...state.settings,
        ...updates,
        keyThreshold: Math.max(1, Number(updates.keyThreshold ?? state.settings.keyThreshold)),
        sipAmountMl: Math.max(1, Number(updates.sipAmountMl ?? state.settings.sipAmountMl))
      };
      state.thirsty = state.dailyStats.keyCount >= state.settings.keyThreshold;
      publishState();
      return state;
    });
    ipcMain.handle("hydrabit:confirm-water", () => {
      return confirmWaterFromHud();
    });
    ipcMain.handle("hydrabit:cancel-hud", () => {
      closeHudWindow();
    });
    ipcMain.handle("hydrabit:trigger-hud", () => createHudWindow());
    ipcMain.handle("hydrabit:add-key-press", () => {
      if (state.keyboardTracker === "window-fallback") incrementKeyCount();
      return state;
    });
    setInterval(() => {
      resetIfNewDay();
      publishState();
    }, 6e4);
  });
}
app.on("window-all-closed", () => void 0);
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  writeState();
});
