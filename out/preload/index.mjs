import { contextBridge, ipcRenderer } from "electron";
const api = {
  getState: () => ipcRenderer.invoke("keysip:get-state"),
  updateSettings: (settings) => ipcRenderer.invoke("keysip:update-settings", settings),
  confirmWater: () => ipcRenderer.invoke("keysip:confirm-water"),
  cancelHud: () => ipcRenderer.invoke("keysip:cancel-hud"),
  triggerHud: () => ipcRenderer.invoke("keysip:trigger-hud"),
  addKeyPress: () => ipcRenderer.invoke("keysip:add-key-press"),
  minimizeToTray: () => ipcRenderer.invoke("keysip:minimize-to-tray"),
  quitApp: () => ipcRenderer.invoke("keysip:quit-app"),
  setMenuOpen: (open) => ipcRenderer.invoke("keysip:set-menu-open", open),
  // Window management
  setAlwaysOnTop: (flag) => ipcRenderer.invoke("keysip:set-always-on-top", flag),
  setLockPosition: (flag) => ipcRenderer.invoke("keysip:set-lock-position", flag),
  setTransparentBg: (flag) => ipcRenderer.invoke("keysip:set-transparent-bg", flag),
  setPetSize: (size) => ipcRenderer.invoke("keysip:set-pet-size", size),
  setPosition: (preset) => ipcRenderer.invoke("keysip:set-position", preset),
  // Hotkey
  setHotkey: (accelerator) => ipcRenderer.invoke("keysip:set-hotkey", accelerator),
  testHotkey: (accelerator) => ipcRenderer.invoke("keysip:test-hotkey", accelerator),
  // Data
  getHistory: () => ipcRenderer.invoke("keysip:get-history"),
  clearToday: () => ipcRenderer.invoke("keysip:clear-today"),
  resetAll: () => ipcRenderer.invoke("keysip:reset-all"),
  // Events
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("keysip:state", listener);
    return () => ipcRenderer.removeListener("keysip:state", listener);
  },
  onHud: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("keysip:hud", listener);
    return () => ipcRenderer.removeListener("keysip:hud", listener);
  },
  onOpenDataPanel: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("keysip:open-data-panel", listener);
    return () => ipcRenderer.removeListener("keysip:open-data-panel", listener);
  }
};
contextBridge.exposeInMainWorld("keysip", api);
