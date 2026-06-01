export type SupplementLog = {
  name: string
  count: number
}

export type Settings = {
  keyThreshold: number
  sipAmountMl: number
  enableSupplements: boolean
  paused: boolean
}

export type DailyStats = {
  date: string
  waterCount: number
  waterMl: number
  keyCount: number
  supplements: SupplementLog[]
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
