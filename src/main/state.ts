import { app } from 'electron'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { AppState, DailyStats, DailyHistory, Settings } from '../shared/types'
import { defaultDailyStats, defaultAppState } from '../shared/defaults'

/* ── Paths ── */
const fromCharCodes = (codes: number[]) => String.fromCharCode(...codes)
const LEGACY_APP_NAME = fromCharCodes([72, 121, 100, 114, 97, 66, 105, 116])
const LEGACY_FILE_PREFIX = fromCharCodes([104, 121, 100, 114, 97, 98, 105, 116])
const STORE_FILE_NAME = 'keysip-state.json'
const HISTORY_FILE_NAME = 'keysip-history.json'
const LEGACY_STORE_FILE_NAME = `${LEGACY_FILE_PREFIX}-state.json`
const LEGACY_HISTORY_FILE_NAME = `${LEGACY_FILE_PREFIX}-history.json`
const legacyUserDataRoot = join(app.getPath('appData'), LEGACY_APP_NAME)

const todayKey = () => new Date().toISOString().slice(0, 10)

const getReadablePath = (currentPath: string, legacyPath: string) => {
  if (existsSync(currentPath)) return currentPath
  if (existsSync(legacyPath)) return legacyPath
  return currentPath
}

const getStorePath = () => join(app.getPath('userData'), STORE_FILE_NAME)
const getHistoryPath = () => join(app.getPath('userData'), HISTORY_FILE_NAME)
const getReadableStorePath = () => getReadablePath(getStorePath(), join(legacyUserDataRoot, LEGACY_STORE_FILE_NAME))
const getReadableHistoryPath = () => getReadablePath(getHistoryPath(), join(legacyUserDataRoot, LEGACY_HISTORY_FILE_NAME))

/* ── Singleton state ── */
let state: AppState
let saveTimer: NodeJS.Timeout | null = null
let broadcastFn: ((state: AppState) => void) | null = null

export const getState = () => state

export const setBroadcastFn = (fn: (state: AppState) => void) => {
  broadcastFn = fn
}

/* ── History persistence ── */
const readHistory = (): Record<string, DailyHistory> => {
  try {
    const path = getReadableHistoryPath()
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
    const keys = Object.keys(history).sort().slice(-30)
    const trimmed: Record<string, DailyHistory> = {}
    for (const k of keys) trimmed[k] = history[k]
    writeFileSync(path, JSON.stringify(trimmed, null, 2), 'utf8')
  } catch (error) {
    console.error('[KeySip] Failed to write history:', error)
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

/* ── State persistence ── */
const readState = (): AppState => {
  try {
    const storePath = getReadableStorePath()
    if (!existsSync(storePath)) return defaultAppState()

    const parsed = JSON.parse(readFileSync(storePath, 'utf8')) as Partial<AppState>
    const parsedDailyStats = parsed.dailyStats?.date === todayKey() ? parsed.dailyStats : defaultDailyStats()
    const dailyStats = {
      ...defaultDailyStats(),
      ...parsedDailyStats,
      waterLogs: parsedDailyStats.waterLogs ?? []
    }
    return {
      settings: { ...defaultAppState().settings, ...parsed.settings },
      dailyStats,
      thirsty: (dailyStats.keyCount ?? 0) >= (parsed.settings?.keyThreshold ?? defaultAppState().settings.keyThreshold),
      keyboardTracker: 'disabled',
      widgetBounds: parsed.widgetBounds
    }
  } catch (error) {
    console.error('[KeySip] Failed to read local state:', error)
    return defaultAppState()
  }
}

const writeState = () => {
  if (!state) return
  try {
    const storePath = getStorePath()
    mkdirSync(dirname(storePath), { recursive: true })
    writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf8')
  } catch (error) {
    console.error('[KeySip] Failed to write local state:', error)
  }
}

const persistSoon = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(writeState, 150)
}

/* ── Day reset ── */
export const resetIfNewDay = () => {
  if (state.dailyStats.date !== todayKey()) {
    saveTodayToHistory()
    state.dailyStats = defaultDailyStats()
    state.thirsty = false
  }
}

/* ── State publishing ── */
export const publishState = () => {
  resetIfNewDay()
  broadcastFn?.(state)
  persistSoon()
}

/* ── State mutations ── */
export const incrementKeyCount = () => {
  resetIfNewDay()
  if (state.settings.paused) return
  state.dailyStats.keyCount += 1
  state.thirsty = state.dailyStats.keyCount >= state.settings.keyThreshold
  publishState()
}

export const confirmWater = () => {
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
  return state
}

export const updateSettings = (updates: Partial<Settings>) => {
  state.settings = {
    ...state.settings,
    ...updates,
    keyThreshold: Math.max(1, Number(updates.keyThreshold ?? state.settings.keyThreshold)),
    sipAmountMl: Math.max(1, Number(updates.sipAmountMl ?? state.settings.sipAmountMl)),
    dailyGoalMl: Math.max(1, Number(updates.dailyGoalMl ?? state.settings.dailyGoalMl))
  }
  state.thirsty = state.dailyStats.keyCount >= state.settings.keyThreshold
  publishState()
  return state
}

export const clearToday = () => {
  state.dailyStats = defaultDailyStats()
  state.thirsty = false
  publishState()
  return state
}

export const resetAll = () => {
  try {
    const historyPath = getHistoryPath()
    if (existsSync(historyPath)) writeFileSync(historyPath, '{}', 'utf8')
  } catch { /* ignore */ }

  state.settings = { ...defaultAppState().settings }
  state.dailyStats = defaultDailyStats()
  state.thirsty = false
  state.widgetBounds = undefined
  publishState()
  return state
}

export const setWidgetBounds = (bounds: AppState['widgetBounds']) => {
  state.widgetBounds = bounds
  persistSoon()
}

/* ── History query ── */
export const getHistory = () => {
  const history = readHistory()
  history[state.dailyStats.date] = {
    date: state.dailyStats.date,
    waterCount: state.dailyStats.waterCount,
    waterMl: state.dailyStats.waterMl,
    goalMet: state.dailyStats.waterMl >= state.settings.dailyGoalMl
  }
  const days = Object.values(history).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

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
}

/* ── Lifecycle ── */
export const initState = () => {
  state = readState()
}

export const saveAndQuit = () => {
  saveTodayToHistory()
  writeState()
}

export const saveOnQuit = () => {
  saveTodayToHistory()
  writeState()
}

export const getKeyboardTracker = () => state.keyboardTracker
export const setKeyboardTracker = (v: AppState['keyboardTracker']) => {
  state.keyboardTracker = v
}
