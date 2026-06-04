import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, Settings, PetSize, PositionPreset } from '../shared/types'

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('keysip:get-state'),
  updateSettings: (settings: Partial<Settings>): Promise<AppState> =>
    ipcRenderer.invoke('keysip:update-settings', settings),
  confirmWater: (): Promise<AppState> => ipcRenderer.invoke('keysip:confirm-water'),
  cancelHud: (): Promise<void> => ipcRenderer.invoke('keysip:cancel-hud'),
  triggerHud: (): Promise<void> => ipcRenderer.invoke('keysip:trigger-hud'),
  addKeyPress: (): Promise<AppState> => ipcRenderer.invoke('keysip:add-key-press'),
  minimizeToTray: (): Promise<void> => ipcRenderer.invoke('keysip:minimize-to-tray'),
  quitApp: (): Promise<void> => ipcRenderer.invoke('keysip:quit-app'),
  setMenuOpen: (open: boolean): Promise<void> => ipcRenderer.invoke('keysip:set-menu-open', open),

  // Window management
  setAlwaysOnTop: (flag: boolean): Promise<AppState> =>
    ipcRenderer.invoke('keysip:set-always-on-top', flag),
  setLockPosition: (flag: boolean): Promise<AppState> =>
    ipcRenderer.invoke('keysip:set-lock-position', flag),
  setTransparentBg: (flag: boolean): Promise<AppState> =>
    ipcRenderer.invoke('keysip:set-transparent-bg', flag),
  setPetSize: (size: PetSize): Promise<AppState> =>
    ipcRenderer.invoke('keysip:set-pet-size', size),
  setPosition: (preset: PositionPreset): Promise<AppState> =>
    ipcRenderer.invoke('keysip:set-position', preset),

  // Hotkey
  setHotkey: (accelerator: string): Promise<{ ok: boolean; error?: string; state: AppState }> =>
    ipcRenderer.invoke('keysip:set-hotkey', accelerator),
  testHotkey: (accelerator: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('keysip:test-hotkey', accelerator),

  // Data
  getHistory: (): Promise<{ days: Array<{ date: string; waterCount: number; waterMl: number; goalMet: boolean }>; streak: number }> =>
    ipcRenderer.invoke('keysip:get-history'),
  clearToday: (): Promise<AppState> =>
    ipcRenderer.invoke('keysip:clear-today'),
  resetAll: (): Promise<AppState> =>
    ipcRenderer.invoke('keysip:reset-all'),

  // Events
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state)
    ipcRenderer.on('keysip:state', listener)
    return () => ipcRenderer.removeListener('keysip:state', listener)
  },
  onHud: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('keysip:hud', listener)
    return () => ipcRenderer.removeListener('keysip:hud', listener)
  },
  onOpenDataPanel: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('keysip:open-data-panel', listener)
    return () => ipcRenderer.removeListener('keysip:open-data-panel', listener)
  }
}

contextBridge.exposeInMainWorld('keysip', api)

declare global {
  interface Window {
    keysip: typeof api
  }
}

