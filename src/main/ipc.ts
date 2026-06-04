import { app, ipcMain, globalShortcut } from 'electron'
import type { Settings, PetSize, PositionPreset } from '../shared/types'
import { getState, updateSettings, confirmWater, clearToday, resetAll, getHistory, incrementKeyCount, publishState, saveOnQuit } from './state'
import {
  createHudWindow,
  closeHudWindow,
  hideWidgetWindow,
  ensureWidgetVisible,
  resizeWidget,
  moveWidgetToPreset,
  setWidgetMenuOpen,
  sendToWidget,
  getWidgetWindow
} from './windows'
import { registerHotkey } from './hotkey'
import { updateTrayMenuSoon } from './tray'

export const registerAllIpcHandlers = () => {
  /* ── State ── */
  ipcMain.handle('keysip:get-state', () => {
    return getState()
  })

  /* ── Settings ── */
  ipcMain.handle('keysip:update-settings', (_event, updates: Partial<Settings>) => {
    const state = updateSettings(updates)

    if (updates.autoLaunch !== undefined) {
      app.setLoginItemSettings({
        openAtLogin: updates.autoLaunch,
        path: app.getPath('exe')
      })
    }

    updateTrayMenuSoon()
    return state
  })

  /* ── Water actions ── */
  ipcMain.handle('keysip:confirm-water', () => {
    const state = getState()
    confirmWater()
    closeHudWindow()
    ensureWidgetVisible()
    updateTrayMenuSoon()
    return state
  })

  ipcMain.handle('keysip:cancel-hud', () => {
    closeHudWindow()
  })

  ipcMain.handle('keysip:trigger-hud', () => createHudWindow())

  ipcMain.handle('keysip:add-key-press', () => {
    const state = getState()
    if (state.keyboardTracker === 'window-fallback') incrementKeyCount()
    return state
  })

  /* ── Window management ── */
  ipcMain.handle('keysip:minimize-to-tray', () => {
    hideWidgetWindow()
    updateTrayMenuSoon()
  })

  ipcMain.handle('keysip:quit-app', () => {
    saveOnQuit()
    app.quit()
  })

  ipcMain.handle('keysip:set-menu-open', (_event, open: boolean) => {
    setWidgetMenuOpen(open)
  })

  ipcMain.handle('keysip:set-always-on-top', (_event, flag: boolean) => {
    const state = getState()
    state.settings.alwaysOnTop = flag
    getWidgetWindow()?.setAlwaysOnTop(flag)
    publishState()
    return state
  })

  ipcMain.handle('keysip:set-lock-position', (_event, flag: boolean) => {
    const state = getState()
    state.settings.lockPosition = flag
    sendToWidget('keysip:state', state)
    publishState()
    return state
  })

  ipcMain.handle('keysip:set-transparent-bg', (_event, flag: boolean) => {
    const state = getState()
    state.settings.transparentBg = flag
    sendToWidget('keysip:state', state)
    publishState()
    return state
  })

  ipcMain.handle('keysip:set-pet-size', (_event, size: PetSize) => {
    const state = getState()
    state.settings.petSize = size
    resizeWidget(size)
    publishState()
    return state
  })

  ipcMain.handle('keysip:set-position', (_event, preset: PositionPreset) => {
    const state = getState()
    state.settings.positionPreset = preset
    if (preset !== 'free') {
      moveWidgetToPreset(preset)
    }
    publishState()
    return state
  })

  /* ── Hotkey ── */
  ipcMain.handle('keysip:set-hotkey', (_event, accelerator: string) => {
    const result = registerHotkey(accelerator, () => createHudWindow())
    if (result.ok) {
      const state = getState()
      state.settings.hotkey = accelerator
      publishState()
    }
    return { ...result, state: getState() }
  })

  ipcMain.handle('keysip:test-hotkey', (_event, accelerator: string) => {
    try {
      const ok = globalShortcut.register(accelerator, () => { /* noop test */ })
      if (ok) {
        globalShortcut.unregister(accelerator)
        return { ok: true }
      }
      return { ok: false, error: '快捷键已被占用' }
    } catch {
      return { ok: false, error: '无效的快捷键组合' }
    }
  })

  /* ── Data ── */
  ipcMain.handle('keysip:get-history', () => {
    return getHistory()
  })

  ipcMain.handle('keysip:clear-today', () => {
    const state = clearToday()
    updateTrayMenuSoon()
    return state
  })

  ipcMain.handle('keysip:reset-all', () => {
    const state = resetAll()
    registerHotkey(state.settings.hotkey, () => createHudWindow())
    app.setLoginItemSettings({
      openAtLogin: false,
      path: app.getPath('exe')
    })
    updateTrayMenuSoon()
    return state
  })
}
