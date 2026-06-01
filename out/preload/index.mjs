import { contextBridge, ipcRenderer } from "electron";
const api = {
  getState: () => ipcRenderer.invoke("hydrabit:get-state"),
  updateSettings: (settings) => ipcRenderer.invoke("hydrabit:update-settings", settings),
  confirmWater: () => ipcRenderer.invoke("hydrabit:confirm-water"),
  cancelHud: () => ipcRenderer.invoke("hydrabit:cancel-hud"),
  triggerHud: () => ipcRenderer.invoke("hydrabit:trigger-hud"),
  addKeyPress: () => ipcRenderer.invoke("hydrabit:add-key-press"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("hydrabit:state", listener);
    return () => ipcRenderer.removeListener("hydrabit:state", listener);
  },
  onHud: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("hydrabit:hud", listener);
    return () => ipcRenderer.removeListener("hydrabit:hud", listener);
  }
};
contextBridge.exposeInMainWorld("hydrabit", api);
