export type SupplementLog = {
  name: string
  count: number
}

export type WaterLog = {
  time: string
  amountMl: number
}

export type PetSize = 'small' | 'medium' | 'large'
export type PositionPreset = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'free'
export type ReminderMode = 'quiet' | 'standard' | 'lively'

export type Settings = {
  keyThreshold: number
  sipAmountMl: number
  enableSupplements: boolean
  paused: boolean
  autoLaunch: boolean
  // New fields
  dailyGoalMl: number
  showHud: boolean
  leakEffect: boolean
  floatAnimation: boolean
  hotkey: string
  alwaysOnTop: boolean
  lockPosition: boolean
  transparentBg: boolean
  petSize: PetSize
  positionPreset: PositionPreset
  reminderMode: ReminderMode
}

export type DailyStats = {
  date: string
  waterCount: number
  waterMl: number
  keyCount: number
  waterLogs: WaterLog[]
  supplements: SupplementLog[]
}

export type DailyHistory = {
  date: string
  waterCount: number
  waterMl: number
  goalMet: boolean
}

export type WidgetBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type AppState = {
  settings: Settings
  dailyStats: DailyStats
  thirsty: boolean
  keyboardTracker: 'global' | 'window-fallback' | 'disabled'
  widgetBounds?: WidgetBounds
}
