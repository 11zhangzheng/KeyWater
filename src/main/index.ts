import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { initState, getState, publishState, resetIfNewDay, saveOnQuit, setBroadcastFn, setKeyboardTracker, incrementKeyCount } from './state'
import { createWidgetWindow, createHudWindow, broadcastState, getWidgetWindow } from './windows'
import { createTray, destroyTray, setWindowRefProvider } from './tray'
import { registerHotkey, unregisterAllHotkeys } from './hotkey'
import { registerAllIpcHandlers } from './ipc'

/* ── App constants ── */
const APP_NAME = 'KeySip'
const userDataRoot = join(app.getPath('appData'), APP_NAME)
const sessionDataRoot = join(userDataRoot, 'session')
const diskCacheRoot = join(sessionDataRoot, 'cache')

app.setName(APP_NAME)
mkdirSync(diskCacheRoot, { recursive: true })
app.setPath('userData', userDataRoot)
app.setPath('sessionData', sessionDataRoot)
app.commandLine.appendSwitch('disk-cache-dir', diskCacheRoot)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

/* ── Single instance lock ── */
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const widget = getWidgetWindow()
    if (!widget || widget.isDestroyed()) return
    widget.showInactive()
    widget.moveTop()
  })

  app.whenReady().then(async () => {
    /* Init state from disk */
    initState()
    setBroadcastFn(broadcastState)

    /* Wire up window references for tray */
    setWindowRefProvider(() => ({
      widget: getWidgetWindow(),
      showWidget: () => {
        const w = getWidgetWindow()
        if (w && !w.isDestroyed()) {
          w.showInactive()
          w.moveTop()
        }
      },
      hideWidget: () => {
        const w = getWidgetWindow()
        if (w && !w.isDestroyed()) w.hide()
      },
      triggerHud: () => createHudWindow(),
      openDataPanel: () => {
        const w = getWidgetWindow()
        if (w && !w.isDestroyed()) {
          w.showInactive()
          const sendOpen = () => w.webContents.send('keysip:open-data-panel')
          if (w.webContents.isLoading()) {
            w.webContents.once('did-finish-load', sendOpen)
          } else {
            sendOpen()
          }
        }
      }
    }))

    /* Create windows and tray */
    createWidgetWindow()
    createTray()

    /* Register hotkey */
    registerHotkey(getState().settings.hotkey, () => createHudWindow())

    /* Start keyboard tracker */
    await startKeyboardActivityTracker()

    /* Register all IPC handlers */
    registerAllIpcHandlers()

    /* Periodic state sync (safety net) */
    setInterval(() => {
      resetIfNewDay()
      publishState()
    }, 60_000)
  })
}

/* ── Keyboard activity tracker ── */
const startKeyboardActivityTracker = async () => {
  try {
    const hookModule = await import('uiohook-napi')
    const hook = hookModule.uIOhook
    hook.on('keydown', incrementKeyCount)
    hook.start()
    setKeyboardTracker('global')
    publishState()
  } catch (error) {
    console.warn('[KeySip] Global keyboard tracker unavailable, using window fallback:', error)
    setKeyboardTracker('window-fallback')
    publishState()
  }
}

/* ── App lifecycle ── */
app.on('window-all-closed', () => undefined)

app.on('will-quit', () => {
  saveOnQuit()
  destroyTray()
  unregisterAllHotkeys()
})
