import { nativeImage, app, ipcMain, globalShortcut, BrowserWindow, Tray, screen, Menu } from "electron";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const WIDGET_MARGIN = 18;
const PET_SIZES = {
  small: { width: 180, height: 156 },
  medium: { width: 280, height: 232 },
  large: { width: 380, height: 308 }
};
const MENU_WIDGET_SIZE = {
  width: 340,
  height: 430
};
const clampNumber = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};
const getDefaultWidgetBounds = (workArea, width, height, margin = WIDGET_MARGIN) => ({
  width,
  height,
  x: Math.round(workArea.x + workArea.width - width - margin),
  y: Math.round(workArea.y + workArea.height - height - margin)
});
const getDisplayForBounds = (displays, fallbackDisplay, bounds, width = bounds.width, height = bounds.height) => {
  const centerX = bounds.x + width / 2;
  const centerY = bounds.y + height / 2;
  return displays.find(({ workArea }) => {
    const insideX = centerX >= workArea.x && centerX <= workArea.x + workArea.width;
    const insideY = centerY >= workArea.y && centerY <= workArea.y + workArea.height;
    return insideX && insideY;
  }) ?? fallbackDisplay;
};
const clampWidgetBounds$1 = (displays, fallbackDisplay, bounds, width, height, margin = WIDGET_MARGIN) => {
  const { workArea } = getDisplayForBounds(displays, fallbackDisplay, bounds, width, height);
  const minX = workArea.x + margin;
  const minY = workArea.y + margin;
  const maxX = Math.max(minX, workArea.x + workArea.width - width - margin);
  const maxY = Math.max(minY, workArea.y + workArea.height - height - margin);
  return {
    width,
    height,
    x: Math.round(clampNumber(bounds.x, minX, maxX)),
    y: Math.round(clampNumber(bounds.y, minY, maxY))
  };
};
const getPositionForPreset$1 = (workArea, preset, width, height, margin = WIDGET_MARGIN) => {
  const positions = {
    "bottom-right": { x: workArea.x + workArea.width - width - margin, y: workArea.y + workArea.height - height - margin },
    "bottom-left": { x: workArea.x + margin, y: workArea.y + workArea.height - height - margin },
    "top-right": { x: workArea.x + workArea.width - width - margin, y: workArea.y + margin },
    "top-left": { x: workArea.x + margin, y: workArea.y + margin }
  };
  const position = positions[preset] ?? positions["bottom-right"];
  return { width, height, x: Math.round(position.x), y: Math.round(position.y) };
};
const getMenuWidgetBounds = (displays, fallbackDisplay, currentBounds, petSize, open, margin = WIDGET_MARGIN) => {
  const currentRight = currentBounds.x + currentBounds.width;
  const currentBottom = currentBounds.y + currentBounds.height;
  const { workArea } = getDisplayForBounds(displays, fallbackDisplay, currentBounds);
  const baseSize = PET_SIZES[petSize];
  const targetSize = open ? {
    width: Math.min(MENU_WIDGET_SIZE.width, Math.max(baseSize.width, workArea.width - margin * 2)),
    height: Math.min(MENU_WIDGET_SIZE.height, Math.max(baseSize.height, workArea.height - margin * 2))
  } : baseSize;
  const minX = workArea.x + margin;
  const minY = workArea.y + margin;
  const maxX = Math.max(minX, workArea.x + workArea.width - targetSize.width - margin);
  const maxY = Math.max(minY, workArea.y + workArea.height - targetSize.height - margin);
  return {
    width: targetSize.width,
    height: targetSize.height,
    x: Math.round(clampNumber(currentRight - targetSize.width, minX, maxX)),
    y: Math.round(clampNumber(currentBottom - targetSize.height, minY, maxY))
  };
};
const ICON_PIXELS = [
  "................",
  ".......DD.......",
  "......DFFD......",
  ".....DFFFFD.....",
  "....DFFFFFFD....",
  "...DFFFFFFFFD...",
  "..DFFFFFFFFFFD..",
  "..DFFLFFFFHFFD..",
  ".DFFLLFFFHHFFFD.",
  ".DFFFFFFFFFFFFD.",
  ".DFFFLFFFFFFFD.",
  "..DFFFFFFFFFFD..",
  "..DFFFFFFFFFFD..",
  "...DFFFFFFFFD...",
  "....DDDDDDDD....",
  "................"
];
const COLORS = {
  ".": [0, 0, 0, 0],
  D: [14, 74, 122, 255],
  F: [66, 191, 245, 255],
  L: [171, 244, 255, 255],
  H: [234, 251, 255, 255]
};
const crcTable = (() => {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();
const crc32 = (buffer) => {
  let crc = 4294967295;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  }
  return (crc ^ 4294967295) >>> 0;
};
const pngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
};
const encodePng = (width, height, rgba) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(rgba.subarray(y * stride, (y + 1) * stride));
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
};
const renderIconPixels = (scale) => {
  const sourceSize = ICON_PIXELS.length;
  const size = sourceSize * scale;
  const buffer = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceY = Math.floor(y / scale);
      const sourceX = Math.floor(x / scale);
      const color = COLORS[ICON_PIXELS[sourceY][sourceX]] ?? COLORS["."];
      const offset = (y * size + x) * 4;
      buffer[offset] = color[0];
      buffer[offset + 1] = color[1];
      buffer[offset + 2] = color[2];
      buffer[offset + 3] = color[3];
    }
  }
  return { size, buffer };
};
const createTrayIcon = () => {
  const { size, buffer } = renderIconPixels(2);
  const image = nativeImage.createFromBuffer(encodePng(size, size, buffer));
  image.setTemplateImage(false);
  return image;
};
const APP_NAME = "KeySip";
const fromCharCodes = (codes) => String.fromCharCode(...codes);
const LEGACY_APP_NAME = fromCharCodes([72, 121, 100, 114, 97, 66, 105, 116]);
const STORE_FILE_NAME = "keysip-state.json";
const HISTORY_FILE_NAME = "keysip-history.json";
const LEGACY_FILE_PREFIX = fromCharCodes([104, 121, 100, 114, 97, 98, 105, 116]);
const LEGACY_STORE_FILE_NAME = `${LEGACY_FILE_PREFIX}-state.json`;
const LEGACY_HISTORY_FILE_NAME = `${LEGACY_FILE_PREFIX}-history.json`;
const userDataRoot = join(app.getPath("appData"), APP_NAME);
const legacyUserDataRoot = join(app.getPath("appData"), LEGACY_APP_NAME);
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
  paused: false,
  autoLaunch: false,
  dailyGoalMl: 2e3,
  showHud: true,
  leakEffect: true,
  floatAnimation: true,
  hotkey: "CommandOrControl+Shift+W",
  alwaysOnTop: true,
  lockPosition: false,
  transparentBg: true,
  petSize: "medium",
  positionPreset: "bottom-right",
  reminderMode: "standard"
};
let widgetWindow = null;
let hudWindow = null;
let tray = null;
let state;
let saveTimer = null;
let trayMenuTimer = null;
let ignoreNextBoundsPersist = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const todayKey = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const defaultDailyStats = () => ({
  date: todayKey(),
  waterCount: 0,
  waterMl: 0,
  keyCount: 0,
  waterLogs: [],
  supplements: []
});
const getReadablePath = (currentPath, legacyPath) => {
  if (existsSync(currentPath)) return currentPath;
  if (existsSync(legacyPath)) return legacyPath;
  return currentPath;
};
const getStorePath = () => join(app.getPath("userData"), STORE_FILE_NAME);
const getHistoryPath = () => join(app.getPath("userData"), HISTORY_FILE_NAME);
const getReadableStorePath = () => getReadablePath(getStorePath(), join(legacyUserDataRoot, LEGACY_STORE_FILE_NAME));
const getReadableHistoryPath = () => getReadablePath(getHistoryPath(), join(legacyUserDataRoot, LEGACY_HISTORY_FILE_NAME));
const getPreloadPath = () => join(__dirname, "../preload/index.mjs");
const readHistory = () => {
  try {
    const path = getReadableHistoryPath();
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
};
const writeHistory = (history) => {
  try {
    const path = getHistoryPath();
    mkdirSync(dirname(path), { recursive: true });
    const keys = Object.keys(history).sort().slice(-30);
    const trimmed = {};
    for (const k of keys) trimmed[k] = history[k];
    writeFileSync(path, JSON.stringify(trimmed, null, 2), "utf8");
  } catch (error) {
    console.error("[KeySip] Failed to write history:", error);
  }
};
const saveTodayToHistory = () => {
  if (!state) return;
  const h = readHistory();
  h[state.dailyStats.date] = {
    date: state.dailyStats.date,
    waterCount: state.dailyStats.waterCount,
    waterMl: state.dailyStats.waterMl,
    goalMet: state.dailyStats.waterMl >= state.settings.dailyGoalMl
  };
  writeHistory(h);
};
const readState = () => {
  const fallback = {
    settings: DEFAULT_SETTINGS,
    dailyStats: defaultDailyStats(),
    thirsty: false,
    keyboardTracker: "disabled"
  };
  try {
    const storePath = getReadableStorePath();
    if (!existsSync(storePath)) return fallback;
    const parsed = JSON.parse(readFileSync(storePath, "utf8"));
    const parsedDailyStats = parsed.dailyStats?.date === todayKey() ? parsed.dailyStats : defaultDailyStats();
    const dailyStats = {
      ...defaultDailyStats(),
      ...parsedDailyStats,
      waterLogs: parsedDailyStats.waterLogs ?? []
    };
    return {
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      dailyStats,
      thirsty: (dailyStats.keyCount ?? 0) >= (parsed.settings?.keyThreshold ?? DEFAULT_SETTINGS.keyThreshold),
      keyboardTracker: "disabled",
      widgetBounds: parsed.widgetBounds
    };
  } catch (error) {
    console.error("[KeySip] Failed to read local state:", error);
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
    console.error("[KeySip] Failed to write local state:", error);
  }
};
const persistSoon = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeState, 150);
};
const resetIfNewDay = () => {
  if (state.dailyStats.date !== todayKey()) {
    saveTodayToHistory();
    state.dailyStats = defaultDailyStats();
    state.thirsty = false;
  }
};
const publishState = () => {
  resetIfNewDay();
  widgetWindow?.webContents.send("keysip:state", state);
  hudWindow?.webContents.send("keysip:state", state);
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
  state.dailyStats.waterLogs = [
    ...state.dailyStats.waterLogs ?? [],
    {
      time: (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      amountMl: state.settings.sipAmountMl
    }
  ].slice(-24);
  state.dailyStats.keyCount = 0;
  state.thirsty = false;
  publishState();
  updateTrayMenuSoon();
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
const clampWidgetBounds = (bounds, width, height) => {
  return clampWidgetBounds$1(screen.getAllDisplays(), screen.getPrimaryDisplay(), bounds, width, height);
};
const getInitialWidgetBounds = (width, height) => {
  if (!state.widgetBounds) {
    return getDefaultWidgetBounds(screen.getPrimaryDisplay().workArea, width, height);
  }
  return clampWidgetBounds(state.widgetBounds, width, height);
};
const rememberWidgetBounds = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  if (ignoreNextBoundsPersist) return;
  state.widgetBounds = widgetWindow.getBounds();
  persistSoon();
};
const setWidgetBounds = (bounds, persist) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  if (!persist) {
    ignoreNextBoundsPersist = true;
  }
  widgetWindow.setBounds(bounds);
  if (persist) {
    state.widgetBounds = bounds;
    persistSoon();
  } else {
    setTimeout(() => {
      ignoreNextBoundsPersist = false;
    }, 80);
  }
};
const getPositionForPreset = (preset, width, height) => {
  return getPositionForPreset$1(screen.getPrimaryDisplay().workArea, preset, width, height);
};
const createWidgetWindow = () => {
  const size = PET_SIZES[state.settings.petSize];
  const bounds = state.settings.positionPreset === "free" ? getInitialWidgetBounds(size.width, size.height) : getPositionForPreset(state.settings.positionPreset, size.width, size.height);
  state.widgetBounds = bounds;
  persistSoon();
  widgetWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: state.settings.transparentBg,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: state.settings.alwaysOnTop,
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
  widgetWindow.on("show", updateTrayMenuSoon);
  widgetWindow.on("hide", updateTrayMenuSoon);
  if (process.env.ELECTRON_RENDERER_URL) {
    widgetWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    widgetWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
  widgetWindow.on("closed", () => {
    widgetWindow = null;
    updateTrayMenuSoon();
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
    hudWindow?.webContents.send("keysip:state", state);
    hudWindow?.show();
    hudWindow?.focus();
  });
  hudWindow.on("closed", () => {
    hudWindow = null;
  });
};
const ensureWidgetVisible = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow();
  }
  widgetWindow?.showInactive();
  widgetWindow?.moveTop();
};
const isWidgetVisible = () => {
  return Boolean(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible());
};
const hideWidgetWindow = () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide();
  }
};
const quitApp = () => {
  saveTodayToHistory();
  writeState();
  app.quit();
};
const toggleTrayPause = () => {
  state.settings.paused = !state.settings.paused;
  publishState();
  updateTrayMenuSoon();
};
const openDataPanelFromTray = () => {
  ensureWidgetVisible();
  const sendOpenDataPanel = () => widgetWindow?.webContents.send("keysip:open-data-panel");
  if (widgetWindow?.webContents.isLoading()) {
    widgetWindow.webContents.once("did-finish-load", sendOpenDataPanel);
  } else {
    sendOpenDataPanel();
  }
  updateTrayMenuSoon();
};
const triggerWaterFromTray = () => {
  ensureWidgetVisible();
  createHudWindow();
  updateTrayMenuSoon();
};
const getTrayStatusLabel = () => {
  if (state.settings.paused) return "暂停中";
  if (state.thirsty) return "口渴中";
  return "正常";
};
const getTrayTooltip = () => {
  return [
    "KeySip - 水蓝蓝",
    `今日 ${state.dailyStats.waterMl}ml / ${state.dailyStats.waterCount}次`,
    `状态：${getTrayStatusLabel()}`
  ].join("\n");
};
const updateTrayMenu = () => {
  if (!tray || !state) return;
  const widgetVisible = isWidgetVisible();
  const sipAmount = state.settings.sipAmountMl;
  const todayWater = state.dailyStats.waterMl;
  const todayCount = state.dailyStats.waterCount;
  const progress = Math.min(100, Math.round(todayWater / state.settings.dailyGoalMl * 100));
  const hotkey = state.settings.hotkey.replace("CommandOrControl", process.platform === "darwin" ? "Cmd" : "Ctrl");
  const menuTemplate = [
    {
      label: widgetVisible ? "隐藏水蓝蓝" : "显示水蓝蓝",
      click: () => {
        if (widgetVisible) {
          hideWidgetWindow();
        } else {
          ensureWidgetVisible();
        }
        updateTrayMenuSoon();
      }
    },
    {
      label: `喝一口 (+${sipAmount}ml)`,
      accelerator: state.settings.hotkey,
      click: triggerWaterFromTray
    },
    {
      label: "饮水数据",
      click: openDataPanelFromTray
    },
    {
      label: state.settings.paused ? "恢复提醒" : "暂停提醒",
      type: "checkbox",
      checked: state.settings.paused,
      click: toggleTrayPause
    },
    { type: "separator" },
    {
      label: `今日 ${todayWater}ml / ${todayCount}次`,
      enabled: false
    },
    {
      label: `目标进度 ${progress}% (${state.settings.dailyGoalMl}ml)`,
      enabled: false
    },
    {
      label: `状态：${getTrayStatusLabel()}`,
      enabled: false
    },
    {
      label: `快捷键：${hotkey}`,
      enabled: false
    },
    { type: "separator" },
    {
      label: "退出 KeySip",
      click: quitApp
    }
  ];
  tray.setToolTip(getTrayTooltip());
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
};
const updateTrayMenuSoon = () => {
  if (trayMenuTimer) clearTimeout(trayMenuTimer);
  trayMenuTimer = setTimeout(() => {
    trayMenuTimer = null;
    updateTrayMenu();
  }, 120);
};
const createTray = () => {
  if (tray) return;
  tray = new Tray(createTrayIcon());
  tray.setToolTip(getTrayTooltip());
  updateTrayMenu();
  tray.on("click", () => {
    if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
      hideWidgetWindow();
    } else {
      ensureWidgetVisible();
    }
    updateTrayMenuSoon();
  });
  tray.on("double-click", () => {
    ensureWidgetVisible();
    updateTrayMenuSoon();
  });
  tray.on("right-click", updateTrayMenu);
};
let currentHotkey = "";
const registerHotkey = (accelerator) => {
  if (currentHotkey) {
    try {
      globalShortcut.unregister(currentHotkey);
    } catch {
    }
  }
  const registered = globalShortcut.register(accelerator, () => {
    createHudWindow();
  });
  if (registered) {
    currentHotkey = accelerator;
    return { ok: true };
  }
  return { ok: false, error: "快捷键注册失败，可能与其他应用冲突" };
};
const resizeWidget = (size) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const { width, height } = PET_SIZES[size];
  const currentBounds = widgetWindow.getBounds();
  const newX = Math.round(currentBounds.x + (currentBounds.width - width) / 2);
  const newY = Math.round(currentBounds.y + (currentBounds.height - height) / 2);
  const newBounds = clampWidgetBounds({ x: newX, y: newY, width, height }, width, height);
  widgetWindow.setBounds(newBounds);
  state.widgetBounds = newBounds;
  persistSoon();
};
const moveWidgetToPreset = (preset) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const { width, height } = PET_SIZES[state.settings.petSize];
  const bounds = getPositionForPreset(preset, width, height);
  widgetWindow.setBounds(bounds);
  state.widgetBounds = bounds;
  persistSoon();
};
const setWidgetMenuOpen = (open) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const currentBounds = widgetWindow.getBounds();
  const bounds = getMenuWidgetBounds(
    screen.getAllDisplays(),
    screen.getPrimaryDisplay(),
    currentBounds,
    state.settings.petSize,
    open
  );
  setWidgetBounds(bounds, !open);
};
const startKeyboardActivityTracker = async () => {
  try {
    const hookModule = await import("uiohook-napi");
    const hook = hookModule.uIOhook;
    hook.on("keydown", incrementKeyCount);
    hook.start();
    state.keyboardTracker = "global";
  } catch (error) {
    console.warn("[KeySip] Global keyboard tracker unavailable, using window fallback:", error);
    state.keyboardTracker = "window-fallback";
  }
  publishState();
};
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    const { width, height } = widgetWindow.getBounds();
    const bounds = getInitialWidgetBounds(width, height);
    widgetWindow.setBounds(bounds);
    state.widgetBounds = bounds;
    persistSoon();
    widgetWindow.showInactive();
    widgetWindow.moveTop();
  });
  app.whenReady().then(async () => {
    state = readState();
    createWidgetWindow();
    createTray();
    registerHotkey(state.settings.hotkey);
    await startKeyboardActivityTracker();
    ipcMain.handle("keysip:get-state", () => {
      resetIfNewDay();
      return state;
    });
    ipcMain.handle("keysip:update-settings", (_event, updates) => {
      state.settings = {
        ...state.settings,
        ...updates,
        keyThreshold: Math.max(1, Number(updates.keyThreshold ?? state.settings.keyThreshold)),
        sipAmountMl: Math.max(1, Number(updates.sipAmountMl ?? state.settings.sipAmountMl)),
        dailyGoalMl: Math.max(1, Number(updates.dailyGoalMl ?? state.settings.dailyGoalMl))
      };
      state.thirsty = state.dailyStats.keyCount >= state.settings.keyThreshold;
      if (updates.autoLaunch !== void 0) {
        app.setLoginItemSettings({
          openAtLogin: updates.autoLaunch,
          path: app.getPath("exe")
        });
      }
      publishState();
      updateTrayMenuSoon();
      return state;
    });
    ipcMain.handle("keysip:confirm-water", () => {
      return confirmWaterFromHud();
    });
    ipcMain.handle("keysip:cancel-hud", () => {
      closeHudWindow();
    });
    ipcMain.handle("keysip:trigger-hud", () => createHudWindow());
    ipcMain.handle("keysip:add-key-press", () => {
      if (state.keyboardTracker === "window-fallback") incrementKeyCount();
      return state;
    });
    ipcMain.handle("keysip:minimize-to-tray", () => {
      hideWidgetWindow();
      updateTrayMenuSoon();
    });
    ipcMain.handle("keysip:quit-app", () => {
      quitApp();
    });
    ipcMain.handle("keysip:set-menu-open", (_event, open) => {
      setWidgetMenuOpen(open);
    });
    ipcMain.handle("keysip:set-always-on-top", (_event, flag) => {
      state.settings.alwaysOnTop = flag;
      widgetWindow?.setAlwaysOnTop(flag);
      publishState();
      return state;
    });
    ipcMain.handle("keysip:set-lock-position", (_event, flag) => {
      state.settings.lockPosition = flag;
      widgetWindow?.webContents.executeJavaScript(
        `document.querySelector('.pet').style.webkitAppRegion = '${flag ? "no-drag" : "drag"}'`
      ).catch(() => {
      });
      publishState();
      return state;
    });
    ipcMain.handle("keysip:set-transparent-bg", (_event, flag) => {
      state.settings.transparentBg = flag;
      widgetWindow?.webContents.send("keysip:state", state);
      publishState();
      return state;
    });
    ipcMain.handle("keysip:set-pet-size", (_event, size) => {
      state.settings.petSize = size;
      resizeWidget(size);
      publishState();
      return state;
    });
    ipcMain.handle("keysip:set-position", (_event, preset) => {
      state.settings.positionPreset = preset;
      if (preset !== "free") {
        moveWidgetToPreset(preset);
      }
      publishState();
      return state;
    });
    ipcMain.handle("keysip:set-hotkey", (_event, accelerator) => {
      const result = registerHotkey(accelerator);
      if (result.ok) {
        state.settings.hotkey = accelerator;
        publishState();
      }
      return { ...result, state };
    });
    ipcMain.handle("keysip:test-hotkey", (_event, accelerator) => {
      try {
        const ok = globalShortcut.register(accelerator, () => {
        });
        if (ok) {
          globalShortcut.unregister(accelerator);
          return { ok: true };
        }
        return { ok: false, error: "快捷键已被占用" };
      } catch {
        return { ok: false, error: "无效的快捷键组合" };
      }
    });
    ipcMain.handle("keysip:get-history", () => {
      const history = readHistory();
      history[state.dailyStats.date] = {
        date: state.dailyStats.date,
        waterCount: state.dailyStats.waterCount,
        waterMl: state.dailyStats.waterMl,
        goalMet: state.dailyStats.waterMl >= state.settings.dailyGoalMl
      };
      const days = Object.values(history).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      let streak = 0;
      const sorted = Object.values(history).sort((a, b) => b.date.localeCompare(a.date));
      for (const day of sorted) {
        if (day.goalMet) {
          streak++;
        } else {
          break;
        }
      }
      return { days, streak };
    });
    ipcMain.handle("keysip:clear-today", () => {
      state.dailyStats = defaultDailyStats();
      state.thirsty = false;
      publishState();
      updateTrayMenuSoon();
      return state;
    });
    ipcMain.handle("keysip:reset-all", () => {
      try {
        const historyPath = getHistoryPath();
        if (existsSync(historyPath)) writeFileSync(historyPath, "{}", "utf8");
      } catch {
      }
      state.settings = { ...DEFAULT_SETTINGS };
      state.dailyStats = defaultDailyStats();
      state.thirsty = false;
      state.widgetBounds = void 0;
      registerHotkey(DEFAULT_SETTINGS.hotkey);
      app.setLoginItemSettings({
        openAtLogin: false,
        path: app.getPath("exe")
      });
      publishState();
      updateTrayMenuSoon();
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
  saveTodayToHistory();
  if (trayMenuTimer) clearTimeout(trayMenuTimer);
  tray?.destroy();
  tray = null;
  globalShortcut.unregisterAll();
  writeState();
});
