import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { AppState, PetSize, PositionPreset, WidgetBounds } from '../shared/types'
import {
  PET_SIZES,
  clampWidgetBounds as calculateClampedWidgetBounds,
  getDefaultWidgetBounds as calculateDefaultWidgetBounds,
  getDisplayForBounds as calculateDisplayForBounds,
  getMenuWidgetBounds,
  getPositionForPreset as calculatePositionForPreset
} from './windowLayout'
import { getState, publishState, setWidgetBounds as saveWidgetBounds, confirmWater } from './state'
import { updateTrayMenuSoon } from './tray'

let widgetWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let ignoreNextBoundsPersist = false

/* ── Exports for tray module ── */
export const getWidgetWindow = () => widgetWindow
export const getHudWindow = () => hudWindow

/* ── Preload path ── */
const getPreloadPath = () => join(__dirname, '../preload/index.mjs')

/* ── Widget bounds helpers ── */
const getDisplayForBoundsLocal = (bounds: WidgetBounds, width: number, height: number) => {
  return calculateDisplayForBounds(screen.getAllDisplays(), screen.getPrimaryDisplay(), bounds, width, height)
}

const clampWidgetBounds = (bounds: WidgetBounds, width: number, height: number): WidgetBounds => {
  return calculateClampedWidgetBounds(screen.getAllDisplays(), screen.getPrimaryDisplay(), bounds, width, height)
}

const getInitialWidgetBounds = (width: number, height: number): WidgetBounds => {
  const state = getState()
  if (!state.widgetBounds) {
    return calculateDefaultWidgetBounds(screen.getPrimaryDisplay().workArea, width, height)
  }
  return clampWidgetBounds(state.widgetBounds, width, height)
}

const rememberWidgetBounds = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (ignoreNextBoundsPersist) return

  saveWidgetBounds(widgetWindow.getBounds())
}

const setWidgetBoundsInternal = (bounds: WidgetBounds, persist: boolean) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  if (!persist) {
    ignoreNextBoundsPersist = true
  }

  widgetWindow.setBounds(bounds)

  if (persist) {
    saveWidgetBounds(bounds)
  } else {
    setTimeout(() => {
      ignoreNextBoundsPersist = false
    }, 80)
  }
}

/* ── Position presets ── */
const getPositionForPreset = (preset: PositionPreset, width: number, height: number): WidgetBounds => {
  return calculatePositionForPreset(screen.getPrimaryDisplay().workArea, preset, width, height)
}

/* ── Widget window ── */
export const createWidgetWindow = () => {
  const state = getState()
  const size = PET_SIZES[state.settings.petSize]
  const bounds = state.settings.positionPreset === 'free'
    ? getInitialWidgetBounds(size.width, size.height)
    : getPositionForPreset(state.settings.positionPreset, size.width, size.height)
  saveWidgetBounds(bounds)

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
  })

  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  widgetWindow.on('moved', rememberWidgetBounds)
  widgetWindow.on('show', updateTrayMenuSoon)
  widgetWindow.on('hide', updateTrayMenuSoon)

  if (process.env.ELECTRON_RENDERER_URL) {
    widgetWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    widgetWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  widgetWindow.on('closed', () => {
    widgetWindow = null
    updateTrayMenuSoon()
  })
}

/* ── HUD window ── */
export const createHudWindow = () => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.show()
    hudWindow.focus()
    return
  }

  const { workArea } = screen.getPrimaryDisplay()
  const width = 420
  const height = 260

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
  })

  hudWindow.setAlwaysOnTop(true, 'screen-saver')
  hudWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    if (input.key === 'Enter') {
      event.preventDefault()
      confirmWaterFromHud()
    }

    if (input.key === 'Escape') {
      event.preventDefault()
      closeHudWindow()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    hudWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?hud=1`)
  } else {
    hudWindow.loadFile(join(__dirname, '../renderer/index.html'), { query: { hud: '1' } })
  }

  hudWindow.once('ready-to-show', () => {
    hudWindow?.webContents.send('keysip:state', getState())
    hudWindow?.show()
    hudWindow?.focus()
  })

  hudWindow.on('closed', () => {
    hudWindow = null
  })
}

/* ── Window operations ── */
export const showWidgetWindow = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  widgetWindow.showInactive()
  widgetWindow.moveTop()
}

export const hideWidgetWindow = () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide()
  }
}

export const ensureWidgetVisible = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow()
  }
  widgetWindow?.showInactive()
  widgetWindow?.moveTop()
}

export const closeHudWindow = () => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close()
  }
}

export const confirmWaterFromHud = () => {
  confirmWater()
  closeHudWindow()
  widgetWindow?.showInactive()
  updateTrayMenuSoon()
}

/* ── Widget resize / move ── */
export const resizeWidget = (size: PetSize) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  const { width, height } = PET_SIZES[size]
  const currentBounds = widgetWindow.getBounds()
  const newX = Math.round(currentBounds.x + (currentBounds.width - width) / 2)
  const newY = Math.round(currentBounds.y + (currentBounds.height - height) / 2)

  const newBounds = clampWidgetBounds({ x: newX, y: newY, width, height }, width, height)
  widgetWindow.setBounds(newBounds)
  saveWidgetBounds(newBounds)
}

export const moveWidgetToPreset = (preset: PositionPreset) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  const state = getState()
  const { width, height } = PET_SIZES[state.settings.petSize]
  const bounds = getPositionForPreset(preset, width, height)
  widgetWindow.setBounds(bounds)
  saveWidgetBounds(bounds)
}

export const setWidgetMenuOpen = (open: boolean) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  const state = getState()
  const currentBounds = widgetWindow.getBounds()
  const bounds = getMenuWidgetBounds(
    screen.getAllDisplays(),
    screen.getPrimaryDisplay(),
    currentBounds,
    state.settings.petSize,
    open
  )

  setWidgetBoundsInternal(bounds, !open)
}

/* ── State sync to windows ── */
export const broadcastState = (state: AppState) => {
  widgetWindow?.webContents.send('keysip:state', state)
  hudWindow?.webContents.send('keysip:state', state)
}

export const sendToWidget = (channel: string, ...args: unknown[]) => {
  widgetWindow?.webContents.send(channel, ...args)
}
