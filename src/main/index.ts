import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, type MenuItemConstructorOptions } from 'electron'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { AppState, DailyStats, DailyHistory, Settings, WidgetBounds, PetSize, PositionPreset } from '../shared/types'
import {
  PET_SIZES,
  clampWidgetBounds as calculateClampedWidgetBounds,
  getDefaultWidgetBounds as calculateDefaultWidgetBounds,
  getDisplayForBounds as calculateDisplayForBounds,
  getMenuWidgetBounds,
  getPositionForPreset as calculatePositionForPreset
} from './windowLayout'
import { createTrayIcon } from './trayIcon'

const APP_NAME = 'HydraBit'
const userDataRoot = join(app.getPath('appData'), APP_NAME)
const sessionDataRoot = join(userDataRoot, 'session')
const diskCacheRoot = join(sessionDataRoot, 'cache')

app.setName(APP_NAME)
mkdirSync(diskCacheRoot, { recursive: true })
app.setPath('userData', userDataRoot)
app.setPath('sessionData', sessionDataRoot)
app.commandLine.appendSwitch('disk-cache-dir', diskCacheRoot)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

const DEFAULT_SETTINGS: Settings = {
  keyThreshold: 2000,
  sipAmountMl: 250,
  enableSupplements: false,
  paused: false,
  autoLaunch: false,
  dailyGoalMl: 2000,
  showHud: true,
  leakEffect: true,
  floatAnimation: true,
  hotkey: 'CommandOrControl+Shift+W',
  alwaysOnTop: true,
  lockPosition: false,
  transparentBg: true,
  petSize: 'medium',
  positionPreset: 'bottom-right',
  reminderMode: 'standard'
}

let widgetWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let tray: Tray | null = null
let state: AppState
let saveTimer: NodeJS.Timeout | null = null
let trayMenuTimer: NodeJS.Timeout | null = null
let ignoreNextBoundsPersist = false
const gotSingleInstanceLock = app.requestSingleInstanceLock()

const todayKey = () => new Date().toISOString().slice(0, 10)

const defaultDailyStats = (): DailyStats => ({
  date: todayKey(),
  waterCount: 0,
  waterMl: 0,
  keyCount: 0,
  waterLogs: [],
  supplements: []
})

const getStorePath = () => join(app.getPath('userData'), 'hydrabit-state.json')
const getHistoryPath = () => join(app.getPath('userData'), 'hydrabit-history.json')
const getPreloadPath = () => join(__dirname, '../preload/index.mjs')

/* ── History persistence ── */
const readHistory = (): Record<string, DailyHistory> => {
  try {
    const path = getHistoryPath()
    if (!existsSync(path)) return {}
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

const writeHistory = (history: Record<string, DailyHistory>) => {
  try {
    const path = getHistoryPath()
    mkdirSync(dirname(path), { recursive: true })
    // Keep only last 30 days
    const keys = Object.keys(history).sort().slice(-30)
    const trimmed: Record<string, DailyHistory> = {}
    for (const k of keys) trimmed[k] = history[k]
    writeFileSync(path, JSON.stringify(trimmed, null, 2), 'utf8')
  } catch (error) {
    console.error('[HydraBit] Failed to write history:', error)
  }
}

const saveTodayToHistory = () => {
  if (!state) return
  const h = readHistory()
  h[state.dailyStats.date] = {
    date: state.dailyStats.date,
    waterCount: state.dailyStats.waterCount,
    waterMl: state.dailyStats.waterMl,
    goalMet: state.dailyStats.waterMl >= state.settings.dailyGoalMl
  }
  writeHistory(h)
}

const readState = (): AppState => {
  const fallback: AppState = {
    settings: DEFAULT_SETTINGS,
    dailyStats: defaultDailyStats(),
    thirsty: false,
    keyboardTracker: 'disabled'
  }

  try {
    const storePath = getStorePath()
    if (!existsSync(storePath)) return fallback

    const parsed = JSON.parse(readFileSync(storePath, 'utf8')) as Partial<AppState>
    const parsedDailyStats = parsed.dailyStats?.date === todayKey() ? parsed.dailyStats : defaultDailyStats()
    const dailyStats = {
      ...defaultDailyStats(),
      ...parsedDailyStats,
      waterLogs: parsedDailyStats.waterLogs ?? []
    }
    return {
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      dailyStats,
      thirsty: (dailyStats.keyCount ?? 0) >= (parsed.settings?.keyThreshold ?? DEFAULT_SETTINGS.keyThreshold),
      keyboardTracker: 'disabled',
      widgetBounds: parsed.widgetBounds
    }
  } catch (error) {
    console.error('[HydraBit] Failed to read local state:', error)
    return fallback
  }
}

const writeState = () => {
  if (!state) return

  try {
    const storePath = getStorePath()
    mkdirSync(dirname(storePath), { recursive: true })
    writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf8')
  } catch (error) {
    console.error('[HydraBit] Failed to write local state:', error)
  }
}

const persistSoon = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(writeState, 150)
}

const resetIfNewDay = () => {
  if (state.dailyStats.date !== todayKey()) {
    // Save yesterday's data to history before resetting
    saveTodayToHistory()
    state.dailyStats = defaultDailyStats()
    state.thirsty = false
  }
}

const publishState = () => {
  resetIfNewDay()
  widgetWindow?.webContents.send('hydrabit:state', state)
  hudWindow?.webContents.send('hydrabit:state', state)
  persistSoon()
}

const incrementKeyCount = () => {
  resetIfNewDay()
  if (state.settings.paused) return
  state.dailyStats.keyCount += 1
  state.thirsty = state.dailyStats.keyCount >= state.settings.keyThreshold
  publishState()
}

const confirmWater = () => {
  resetIfNewDay()
  state.dailyStats.waterCount += 1
  state.dailyStats.waterMl += state.settings.sipAmountMl
  state.dailyStats.waterLogs = [
    ...(state.dailyStats.waterLogs ?? []),
    {
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      amountMl: state.settings.sipAmountMl
    }
  ].slice(-24)
  state.dailyStats.keyCount = 0
  state.thirsty = false
  publishState()
  updateTrayMenuSoon()
  return state
}

const closeHudWindow = () => {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close()
  }
}

const confirmWaterFromHud = () => {
  const nextState = confirmWater()
  closeHudWindow()
  widgetWindow?.showInactive()
  return nextState
}

const showWidgetWindow = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  widgetWindow.showInactive()
  widgetWindow.moveTop()
}

/* ── Widget bounds helpers ── */
const getDisplayForBounds = (bounds: WidgetBounds, width: number, height: number) => {
  return calculateDisplayForBounds(screen.getAllDisplays(), screen.getPrimaryDisplay(), bounds, width, height)
}

const clampWidgetBounds = (bounds: WidgetBounds, width: number, height: number): WidgetBounds => {
  return calculateClampedWidgetBounds(screen.getAllDisplays(), screen.getPrimaryDisplay(), bounds, width, height)
}

const getInitialWidgetBounds = (width: number, height: number): WidgetBounds => {
  if (!state.widgetBounds) {
    return calculateDefaultWidgetBounds(screen.getPrimaryDisplay().workArea, width, height)
  }

  return clampWidgetBounds(state.widgetBounds, width, height)
}

const rememberWidgetBounds = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (ignoreNextBoundsPersist) return

  state.widgetBounds = widgetWindow.getBounds()
  persistSoon()
}

const setWidgetBounds = (bounds: WidgetBounds, persist: boolean) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  if (!persist) {
    ignoreNextBoundsPersist = true
  }

  widgetWindow.setBounds(bounds)

  if (persist) {
    state.widgetBounds = bounds
    persistSoon()
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
const createWidgetWindow = () => {
  const size = PET_SIZES[state.settings.petSize]
  const bounds = state.settings.positionPreset === 'free'
    ? getInitialWidgetBounds(size.width, size.height)
    : getPositionForPreset(state.settings.positionPreset, size.width, size.height)
  state.widgetBounds = bounds
  persistSoon()

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
const createHudWindow = () => {
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
    hudWindow?.webContents.send('hydrabit:state', state)
    hudWindow?.show()
    hudWindow?.focus()
  })

  hudWindow.on('closed', () => {
    hudWindow = null
  })
}

/* ── Tray ── */
const ensureWidgetVisible = () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow()
  }

  widgetWindow?.showInactive()
  widgetWindow?.moveTop()
}

const isWidgetVisible = () => {
  return Boolean(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible())
}

const hideWidgetWindow = () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide()
  }
}

const quitApp = () => {
  saveTodayToHistory()
  writeState()
  app.quit()
}

const toggleTrayPause = () => {
  state.settings.paused = !state.settings.paused
  publishState()
  updateTrayMenuSoon()
}

const openDataPanelFromTray = () => {
  ensureWidgetVisible()
  const sendOpenDataPanel = () => widgetWindow?.webContents.send('hydrabit:open-data-panel')

  if (widgetWindow?.webContents.isLoading()) {
    widgetWindow.webContents.once('did-finish-load', sendOpenDataPanel)
  } else {
    sendOpenDataPanel()
  }
  updateTrayMenuSoon()
}

const triggerWaterFromTray = () => {
  ensureWidgetVisible()
  createHudWindow()
  updateTrayMenuSoon()
}

const getTrayStatusLabel = () => {
  if (state.settings.paused) return '暂停中'
  if (state.thirsty) return '口渴中'
  return '正常'
}

const getTrayTooltip = () => {
  return [
    'HydraBit - 水蓝蓝',
    `今日 ${state.dailyStats.waterMl}ml / ${state.dailyStats.waterCount}次`,
    `状态：${getTrayStatusLabel()}`
  ].join('\n')
}

const updateTrayMenu = () => {
  if (!tray || !state) return

  const widgetVisible = isWidgetVisible()
  const sipAmount = state.settings.sipAmountMl
  const todayWater = state.dailyStats.waterMl
  const todayCount = state.dailyStats.waterCount
  const progress = Math.min(100, Math.round((todayWater / state.settings.dailyGoalMl) * 100))
  const hotkey = state.settings.hotkey.replace('CommandOrControl', process.platform === 'darwin' ? 'Cmd' : 'Ctrl')
  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      label: widgetVisible ? '隐藏水蓝蓝' : '显示水蓝蓝',
      click: () => {
        if (widgetVisible) {
          hideWidgetWindow()
        } else {
          ensureWidgetVisible()
        }
        updateTrayMenuSoon()
      }
    },
    {
      label: `喝一口 (+${sipAmount}ml)`,
      accelerator: state.settings.hotkey,
      click: triggerWaterFromTray
    },
    {
      label: '饮水数据',
      click: openDataPanelFromTray
    },
    {
      label: state.settings.paused ? '恢复提醒' : '暂停提醒',
      type: 'checkbox',
      checked: state.settings.paused,
      click: toggleTrayPause
    },
    { type: 'separator' },
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
    { type: 'separator' },
    {
      label: '退出 HydraBit',
      click: quitApp
    }
  ]

  tray.setToolTip(getTrayTooltip())
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate))
}

const updateTrayMenuSoon = () => {
  if (trayMenuTimer) clearTimeout(trayMenuTimer)
  trayMenuTimer = setTimeout(() => {
    trayMenuTimer = null
    updateTrayMenu()
  }, 120)
}

const createTray = () => {
  if (tray) return

  tray = new Tray(createTrayIcon())
  tray.setToolTip(getTrayTooltip())
  updateTrayMenu()

  tray.on('click', () => {
    if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
      hideWidgetWindow()
    } else {
      ensureWidgetVisible()
    }
    updateTrayMenuSoon()
  })

  tray.on('double-click', () => {
    ensureWidgetVisible()
    updateTrayMenuSoon()
  })

  tray.on('right-click', updateTrayMenu)
}

/* ── Hotkey management ── */
let currentHotkey = ''

const registerHotkey = (accelerator: string) => {
  // Unregister old
  if (currentHotkey) {
    try { globalShortcut.unregister(currentHotkey) } catch { /* ignore */ }
  }

  const registered = globalShortcut.register(accelerator, () => {
    createHudWindow()
  })

  if (registered) {
    currentHotkey = accelerator
    return { ok: true }
  }
  return { ok: false, error: '快捷键注册失败，可能与其他应用冲突' }
}

/* ── Window management ── */
const resizeWidget = (size: PetSize) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  const { width, height } = PET_SIZES[size]
  const currentBounds = widgetWindow.getBounds()

  // Calculate new position to keep centered
  const newX = Math.round(currentBounds.x + (currentBounds.width - width) / 2)
  const newY = Math.round(currentBounds.y + (currentBounds.height - height) / 2)

  const newBounds = clampWidgetBounds({ x: newX, y: newY, width, height }, width, height)
  widgetWindow.setBounds(newBounds)
  state.widgetBounds = newBounds
  persistSoon()
}

const moveWidgetToPreset = (preset: PositionPreset) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  const { width, height } = PET_SIZES[state.settings.petSize]
  const bounds = getPositionForPreset(preset, width, height)
  widgetWindow.setBounds(bounds)
  state.widgetBounds = bounds
  persistSoon()
}

const setWidgetMenuOpen = (open: boolean) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return

  const currentBounds = widgetWindow.getBounds()
  const bounds = getMenuWidgetBounds(
    screen.getAllDisplays(),
    screen.getPrimaryDisplay(),
    currentBounds,
    state.settings.petSize,
    open
  )

  setWidgetBounds(bounds, !open)
}

const startKeyboardActivityTracker = async () => {
  try {
    const hookModule = await import('uiohook-napi')
    const hook = hookModule.uIOhook
    hook.on('keydown', incrementKeyCount)
    hook.start()
    state.keyboardTracker = 'global'
  } catch (error) {
    console.warn('[HydraBit] Global keyboard tracker unavailable, using window fallback:', error)
    state.keyboardTracker = 'window-fallback'
  }
  publishState()
}

/* ── App lifecycle ── */
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return

    const { width, height } = widgetWindow.getBounds()
    const bounds = getInitialWidgetBounds(width, height)
    widgetWindow.setBounds(bounds)
    state.widgetBounds = bounds
    persistSoon()
    widgetWindow.showInactive()
    widgetWindow.moveTop()
  })

  app.whenReady().then(async () => {
    state = readState()
    createWidgetWindow()
    createTray()
    registerHotkey(state.settings.hotkey)
    await startKeyboardActivityTracker()

    /* ── IPC: State ── */
    ipcMain.handle('hydrabit:get-state', () => {
      resetIfNewDay()
      return state
    })

    /* ── IPC: Update settings ── */
    ipcMain.handle('hydrabit:update-settings', (_event, updates: Partial<Settings>) => {
      state.settings = {
        ...state.settings,
        ...updates,
        keyThreshold: Math.max(1, Number(updates.keyThreshold ?? state.settings.keyThreshold)),
        sipAmountMl: Math.max(1, Number(updates.sipAmountMl ?? state.settings.sipAmountMl)),
        dailyGoalMl: Math.max(1, Number(updates.dailyGoalMl ?? state.settings.dailyGoalMl))
      }
      state.thirsty = state.dailyStats.keyCount >= state.settings.keyThreshold

      // Handle auto-launch
      if (updates.autoLaunch !== undefined) {
        app.setLoginItemSettings({
          openAtLogin: updates.autoLaunch,
          path: app.getPath('exe')
        })
      }

      publishState()
      updateTrayMenuSoon()
      return state
    })

    /* ── IPC: Water actions ── */
    ipcMain.handle('hydrabit:confirm-water', () => {
      return confirmWaterFromHud()
    })
    ipcMain.handle('hydrabit:cancel-hud', () => {
      closeHudWindow()
    })
    ipcMain.handle('hydrabit:trigger-hud', () => createHudWindow())
    ipcMain.handle('hydrabit:add-key-press', () => {
      if (state.keyboardTracker === 'window-fallback') incrementKeyCount()
      return state
    })

    /* ── IPC: Window management ── */
    ipcMain.handle('hydrabit:minimize-to-tray', () => {
      hideWidgetWindow()
      updateTrayMenuSoon()
    })

    ipcMain.handle('hydrabit:quit-app', () => {
      quitApp()
    })

    /* ── IPC: Always on top ── */
    ipcMain.handle('hydrabit:set-menu-open', (_event, open: boolean) => {
      setWidgetMenuOpen(open)
    })

    ipcMain.handle('hydrabit:set-always-on-top', (_event, flag: boolean) => {
      state.settings.alwaysOnTop = flag
      widgetWindow?.setAlwaysOnTop(flag)
      publishState()
      return state
    })

    /* ── IPC: Lock position ── */
    ipcMain.handle('hydrabit:set-lock-position', (_event, flag: boolean) => {
      state.settings.lockPosition = flag
      // Inject CSS to toggle drag region
      widgetWindow?.webContents.executeJavaScript(
        `document.querySelector('.pet').style.webkitAppRegion = '${flag ? 'no-drag' : 'drag'}'`
      ).catch(() => { /* ignore */ })
      publishState()
      return state
    })

    /* ── IPC: Transparent background ── */
    ipcMain.handle('hydrabit:set-transparent-bg', (_event, flag: boolean) => {
      state.settings.transparentBg = flag
      // Note: transparency must be set at window creation; we toggle via CSS class
      widgetWindow?.webContents.send('hydrabit:state', state)
      publishState()
      return state
    })

    /* ── IPC: Pet size ── */
    ipcMain.handle('hydrabit:set-pet-size', (_event, size: PetSize) => {
      state.settings.petSize = size
      resizeWidget(size)
      publishState()
      return state
    })

    /* ── IPC: Position preset ── */
    ipcMain.handle('hydrabit:set-position', (_event, preset: PositionPreset) => {
      state.settings.positionPreset = preset
      if (preset !== 'free') {
        moveWidgetToPreset(preset)
      }
      publishState()
      return state
    })

    /* ── IPC: Hotkey ── */
    ipcMain.handle('hydrabit:set-hotkey', (_event, accelerator: string) => {
      const result = registerHotkey(accelerator)
      if (result.ok) {
        state.settings.hotkey = accelerator
        publishState()
      }
      return { ...result, state }
    })

    ipcMain.handle('hydrabit:test-hotkey', (_event, accelerator: string) => {
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

    /* ── IPC: Data management ── */
    ipcMain.handle('hydrabit:get-history', () => {
      const history = readHistory()
      history[state.dailyStats.date] = {
        date: state.dailyStats.date,
        waterCount: state.dailyStats.waterCount,
        waterMl: state.dailyStats.waterMl,
        goalMet: state.dailyStats.waterMl >= state.settings.dailyGoalMl
      }
      const days = Object.values(history).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

      // Calculate streak
      let streak = 0
      const sorted = Object.values(history).sort((a, b) => b.date.localeCompare(a.date))
      for (const day of sorted) {
        if (day.goalMet) {
          streak++
        } else {
          break
        }
      }

      return { days, streak }
    })

    ipcMain.handle('hydrabit:clear-today', () => {
      state.dailyStats = defaultDailyStats()
      state.thirsty = false
      publishState()
      updateTrayMenuSoon()
      return state
    })

    ipcMain.handle('hydrabit:reset-all', () => {
      // Clear history file
      try {
        const historyPath = getHistoryPath()
        if (existsSync(historyPath)) writeFileSync(historyPath, '{}', 'utf8')
      } catch { /* ignore */ }

      state.settings = { ...DEFAULT_SETTINGS }
      state.dailyStats = defaultDailyStats()
      state.thirsty = false
      state.widgetBounds = undefined

      // Re-register default hotkey
      registerHotkey(DEFAULT_SETTINGS.hotkey)

      // Re-apply auto-launch
      app.setLoginItemSettings({
        openAtLogin: false,
        path: app.getPath('exe')
      })

      publishState()
      updateTrayMenuSoon()
      return state
    })

    /* ── Periodic state sync ── */
    setInterval(() => {
      resetIfNewDay()
      publishState()
    }, 60_000)
  })
}

app.on('window-all-closed', () => undefined)

app.on('will-quit', () => {
  saveTodayToHistory()
  if (trayMenuTimer) clearTimeout(trayMenuTimer)
  tray?.destroy()
  tray = null
  globalShortcut.unregisterAll()
  writeState()
})
