import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, Settings } from '../shared/types'

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('hydrabit:get-state'),
  updateSettings: (settings: Partial<Settings>): Promise<AppState> =>
    ipcRenderer.invoke('hydrabit:update-settings', settings),
  confirmWater: (): Promise<AppState> => ipcRenderer.invoke('hydrabit:confirm-water'),
  cancelHud: (): Promise<void> => ipcRenderer.invoke('hydrabit:cancel-hud'),
  triggerHud: (): Promise<void> => ipcRenderer.invoke('hydrabit:trigger-hud'),
  addKeyPress: (): Promise<AppState> => ipcRenderer.invoke('hydrabit:add-key-press'),
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state)
    ipcRenderer.on('hydrabit:state', listener)
    return () => ipcRenderer.removeListener('hydrabit:state', listener)
  },
  onHud: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('hydrabit:hud', listener)
    return () => ipcRenderer.removeListener('hydrabit:hud', listener)
  }
}

contextBridge.exposeInMainWorld('hydrabit', api)

declare global {
  interface Window {
    hydrabit: typeof api
  }
}
