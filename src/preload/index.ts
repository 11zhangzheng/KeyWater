import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, Settings, PetSize, PositionPreset } from '../shared/types'

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('hydrabit:get-state'),
  updateSettings: (settings: Partial<Settings>): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:update-settings', settings),
  confirmWater: (): Promise<AppState> => ipcRenderer.invoke('hydrabit:confirm-water'),
  cancelHud: (): Promise<void> => ipcRenderer.invoke('hydrabit:cancel-hud'),
  triggerHud: (): Promise<void> => ipcRenderer.invoke('hydrabit:trigger-hud'),
  addKeyPress: (): Promise<AppState> => ipcRenderer.invoke('hydrabit:add-key-press'),
  minimizeToTray: (): Promise<void> => ipcRenderer.invoke('hydrabit:minimize-to-tray'),
  quitApp: (): Promise<void> => ipcRenderer.invoke('hydrabit:quit-app'),
  setMenuOpen: (open: boolean): Promise<void> => ipcRenderer.invoke('hydrabit:set-menu-open', open),

  // Window management
  setAlwaysOnTop: (flag: boolean): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:set-always-on-top', flag),
  setLockPosition: (flag: boolean): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:set-lock-position', flag),
  setTransparentBg: (flag: boolean): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:set-transparent-bg', flag),
  setPetSize: (size: PetSize): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:set-pet-size', size),
  setPosition: (preset: PositionPreset): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:set-position', preset),

  // Hotkey
  setHotkey: (accelerator: string): Promise<{ ok: boolean; error?: string; state: AppState }> =>
    ipcRenderer.invoke('hydrabit:set-hotkey', accelerator),
  testHotkey: (accelerator: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('hydrabit:test-hotkey', accelerator),

  // Data
  getHistory: (): Promise<{ days: Array<{ date: string; waterCount: number; waterMl: number; goalMet: boolean }>; streak: number }> =>
    ipcRenderer.invoke('hydrabit:get-history'),
  clearToday: (): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:clear-today'),
  resetAll: (): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:reset-all'),

  // Events
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state)
    ipcRenderer.on('hydrabit:state', listener)
    return () => ipcRenderer.removeListener('hydrabit:state', listener)
  },
  onHud: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('hydrabit:hud', listener)
    return () => ipcRenderer.removeListener('hydrabit:hud', listener)
  },
  onOpenDataPanel: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('hydrabit:open-data-panel', listener)
    return () => ipcRenderer.removeListener('hydrabit:open-data-panel', listener)
  }
}

contextBridge.exposeInMainWorld('hydrabit', api)

declare global {
  interface Window {
    hydrabit: typeof api
  }
}
