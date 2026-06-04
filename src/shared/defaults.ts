import type { AppState, Settings, DailyStats } from './types'

const todayKey = () => new Date().toISOString().slice(0, 10)

export const DEFAULT_SETTINGS: Settings = {
  keyThreshold: 2000,
  sipAmountMl: 250,
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

export const defaultDailyStats = (): DailyStats => ({
  date: todayKey(),
  waterCount: 0,
  waterMl: 0,
  keyCount: 0,
  waterLogs: []
})

export const defaultAppState = (): AppState => ({
  settings: DEFAULT_SETTINGS,
  dailyStats: defaultDailyStats(),
  thirsty: false,
  keyboardTracker: 'disabled'
})
