import { contextBridge, ipcRenderer } from "electron";
const api = {
  getState: () => ipcRenderer.invoke("hydrabit:get-state"),
  updateSettings: (settings) => ipcRenderer.invoke("hydrabit:update-settings", settings),
  confirmWater: () => ipcRenderer.invoke("hydrabit:confirm-water"),
  cancelHud: () => ipcRenderer.invoke("hydrabit:cancel-hud"),
  triggerHud: () => ipcRenderer.invoke("hydrabit:trigger-hud"),
  addKeyPress: () => ipcRenderer.invoke("hydrabit:add-key-press"),
  minimizeToTray: () => ipcRenderer.invoke("hydrabit:minimize-to-tray"),
  quitApp: () => ipcRenderer.invoke("hydrabit:quit-app"),
  setMenuOpen: (open) => ipcRenderer.invoke("hydrabit:set-menu-open", open),
  // Window management
  setAlwaysOnTop: (flag) => ipcRenderer.invoke("hydrabit:set-always-on-top", flag),
  setLockPosition: (flag) => ipcRenderer.invoke("hydrabit:set-lock-position", flag),
  setTransparentBg: (flag) => ipcRenderer.invoke("hydrabit:set-transparent-bg", flag),
  setPetSize: (size) => ipcRenderer.invoke("hydrabit:set-pet-size", size),
  setPosition: (preset) => ipcRenderer.invoke("hydrabit:set-position", preset),
  // Hotkey
  setHotkey: (accelerator) => ipcRenderer.invoke("hydrabit:set-hotkey", accelerator),
  testHotkey: (accelerator) => ipcRenderer.invoke("hydrabit:test-hotkey", accelerator),
  // Data
  getHistory: () => ipcRenderer.invoke("hydrabit:get-history"),
  clearToday: () => ipcRenderer.invoke("hydrabit:clear-today"),
  resetAll: () => ipcRenderer.invoke("hydrabit:reset-all"),
  // Events
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("hydrabit:state", listener);
    return () => ipcRenderer.removeListener("hydrabit:state", listener);
  },
  onHud: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("hydrabit:hud", listener);
    return () => ipcRenderer.removeListener("hydrabit:hud", listener);
  },
  onOpenDataPanel: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("hydrabit:open-data-panel", listener);
    return () => ipcRenderer.removeListener("hydrabit:open-data-panel", listener);
  }
};
contextBridge.exposeInMainWorld("hydrabit", api);
