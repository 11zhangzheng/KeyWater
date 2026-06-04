import { app, Tray, Menu, type MenuItemConstructorOptions, type BrowserWindow } from 'electron'
import { getState, publishState, saveOnQuit } from './state'
import { createTrayIcon } from './trayIcon'

let tray: Tray | null = null
let trayMenuTimer: NodeJS.Timeout | null = null
let getWindowRefs: (() => { widget: BrowserWindow | null; showWidget: () => void; hideWidget: () => void; triggerHud: () => void; openDataPanel: () => void }) | null = null

export const setWindowRefProvider = (provider: () => { widget: BrowserWindow | null; showWidget: () => void; hideWidget: () => void; triggerHud: () => void; openDataPanel: () => void }) => {
  getWindowRefs = provider
}

const getTrayStatusLabel = () => {
  const state = getState()
  if (state.settings.paused) return '暂停中'
  if (state.thirsty) return '口渴中'
  return '正常'
}

const getTrayTooltip = () => {
  const state = getState()
  return [
    'KeySip - 水蓝蓝',
    `今日 ${state.dailyStats.waterMl}ml / ${state.dailyStats.waterCount}次`,
    `状态：${getTrayStatusLabel()}`
  ].join('\n')
}

const updateTrayMenu = () => {
  const state = getState()
  if (!tray || !state) return

  const refs = getWindowRefs?.()
  const widgetVisible = refs?.widget
    ? !refs.widget.isDestroyed() && refs.widget.isVisible()
    : false

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
          refs?.hideWidget()
        } else {
          refs?.showWidget()
        }
        updateTrayMenuSoon()
      }
    },
    {
      label: `喝一口 (+${sipAmount}ml)`,
      accelerator: state.settings.hotkey,
      click: () => {
        refs?.showWidget()
        refs?.triggerHud()
        updateTrayMenuSoon()
      }
    },
    {
      label: '饮水数据',
      click: () => {
        refs?.openDataPanel()
        updateTrayMenuSoon()
      }
    },
    {
      label: state.settings.paused ? '恢复提醒' : '暂停提醒',
      type: 'checkbox',
      checked: state.settings.paused,
      click: () => {
        state.settings.paused = !state.settings.paused
        publishState()
        updateTrayMenuSoon()
      }
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
      label: '退出 KeySip',
      click: () => {
        saveOnQuit()
        app.quit()
      }
    }
  ]

  tray.setToolTip(getTrayTooltip())
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate))
}

export const updateTrayMenuSoon = () => {
  if (trayMenuTimer) clearTimeout(trayMenuTimer)
  trayMenuTimer = setTimeout(() => {
    trayMenuTimer = null
    updateTrayMenu()
  }, 120)
}

export const createTray = () => {
  if (tray) return

  tray = new Tray(createTrayIcon())
  tray.setToolTip(getTrayTooltip())
  updateTrayMenu()

  tray.on('click', () => {
    const refs = getWindowRefs?.()
    if (refs?.widget && !refs.widget.isDestroyed() && refs.widget.isVisible()) {
      refs.hideWidget()
    } else {
      refs?.showWidget()
    }
    updateTrayMenuSoon()
  })

  tray.on('double-click', () => {
    getWindowRefs?.()?.showWidget()
    updateTrayMenuSoon()
  })

  tray.on('right-click', updateTrayMenu)
}

export const destroyTray = () => {
  if (trayMenuTimer) clearTimeout(trayMenuTimer)
  tray?.destroy()
  tray = null
}
