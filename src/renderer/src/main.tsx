import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import './styles.css'
import type { AppState, PetSize, PositionPreset, ReminderMode } from '../../shared/types'

/* ── Fallback state ── */
const fallbackState: AppState = {
  settings: {
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
  },
  dailyStats: {
    date: new Date().toISOString().slice(0, 10),
    waterCount: 0,
    waterMl: 0,
    keyCount: 0,
    supplements: []
  },
  thirsty: false,
  keyboardTracker: 'disabled'
}

/* ── State derivation ── */
type PetState = 'full' | 'normal' | 'thirsty' | 'empty'

function getPetState(progress: number): PetState {
  if (progress >= 0.95) return 'empty'
  if (progress >= 0.8) return 'thirsty'
  if (progress >= 0.4) return 'normal'
  return 'full'
}

/* ── Presets ── */
const REMINDER_PRESETS = [
  { label: '轻', threshold: 3000 },
  { label: '标准', threshold: 2000 },
  { label: '频繁', threshold: 1000 }
]

const SIP_PRESETS = [150, 200, 250, 300, 500]

const HOTKEY_PLATFORM = navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'

function formatHotkey(accelerator: string): string {
  return accelerator
    .replace('CommandOrControl', HOTKEY_PLATFORM)
    .replace('Command', 'Cmd')
    .replace('Control', 'Ctrl')
    .replace('Shift', 'Shift')
    .replace('Alt', 'Alt')
    .replace('+', ' + ')
}

/* ════════════════════════════════════════
   Pet Component — 水蓝蓝
   ════════════════════════════════════════ */
function Pet({
  progress,
  animationsEnabled,
  isRefilling,
  isPaused,
  reminderMode,
  leakEffect
}: {
  progress: number
  animationsEnabled: boolean
  isRefilling: boolean
  isPaused: boolean
  reminderMode: ReminderMode
  leakEffect: boolean
}) {
  const waterPercent = Math.round((1 - progress) * 100)
  const petState = getPetState(progress)

  const showShake = reminderMode !== 'quiet' && (petState === 'thirsty' || petState === 'empty')
  const showLeak = leakEffect && reminderMode !== 'quiet' && petState !== 'full'

  return (
    <div
      className={[
        'pet',
        `state-${petState}`,
        isRefilling ? 'refilling' : '',
        !animationsEnabled ? 'no-anim' : '',
        isPaused ? 'paused' : '',
        reminderMode === 'lively' ? 'reminder-lively' : '',
        reminderMode === 'quiet' ? 'reminder-quiet' : '',
        showShake ? 'shake-active' : '',
        showLeak ? 'leak-active' : ''
      ].filter(Boolean).join(' ')}
    >
      <div className="pet-anchor">
        {/* Crown */}
        <div className="crown">
          <div className="crown-center" />
        </div>

        {/* Red goggles */}
        <div className="goggles">
          <div className="goggle-l" />
          <div className="goggle-r" />
          <div className="goggle-center" />
        </div>

        {/* Round body with water fill */}
        <div className="pet-body">
          <div
            className="water"
            style={{ height: `${waterPercent}%` }}
          >
            <div className="bubble bubble-1" />
            <div className="bubble bubble-2" />
            <div className="bubble bubble-3" />
            <div className="water-sparkle" style={{ left: '25%', bottom: '30%', animationDelay: '0s' }} />
            <div className="water-sparkle" style={{ left: '60%', bottom: '50%', animationDelay: '2s' }} />
          </div>

          {/* Leak drip */}
          {showLeak && <div className="leak-drip" />}

          {/* Face */}
          <div className="face">
            <div className="eye eye-l" />
            <div className="eye eye-r" />
            <div className={`mouth mouth-${petState === 'full' ? 'happy' : petState === 'thirsty' ? 'thirsty' : 'normal'}`} />
            <div className="blush blush-l" />
            <div className="blush blush-r" />
            <div className="sweat" />
            <div className="zzz">Z</div>
          </div>
        </div>

        {/* Arms */}
        <div className="arms">
          <div className="arm arm-l" />
          <div className="arm arm-r" />
        </div>

        {/* Feet */}
        <div className="feet">
          <div className="foot foot-l" />
          <div className="foot foot-r" />
        </div>

        {/* Pause indicator */}
        {isPaused && <div className="pause-indicator">⏸</div>}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════
   HUD Component
   ════════════════════════════════════════ */
function Hud({ amount }: { amount: number }) {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown((v) => Math.max(0, v - 1)), 330)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="hud">
      <div className="hud-scan" />
      <div className="hud-ring" />
      <div className="hud-orbit" />
      <div className="hud-copy">
        <strong>SIP! +{amount}ml</strong>
        <span>{countdown ? `SYNC 0${countdown}` : 'ENTER TO LOG'}</span>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════
   PetMenu — Mini toolbox menu
   ════════════════════════════════════════ */
function PetMenu({
  state,
  onRefill,
  onOpenSettings,
  onClose,
  onMinimize,
  onQuit,
  animationsEnabled,
  onToggleAnimations
}: {
  state: AppState
  onRefill: () => void
  onOpenSettings: () => void
  onClose: () => void
  onMinimize: () => void
  onQuit: () => void
  animationsEnabled: boolean
  onToggleAnimations: () => void
}) {
  const [expandSip, setExpandSip] = useState(false)
  const [expandReminder, setExpandReminder] = useState(false)

  const currentSip = state.settings.sipAmountMl
  const currentThreshold = state.settings.keyThreshold
  const isPaused = state.settings.paused

  const reminderLabel = REMINDER_PRESETS.find(p => p.threshold === currentThreshold)?.label
    ?? '自定义'

  const handleSipChange = (ml: number) => {
    window.hydrabit.updateSettings({ sipAmountMl: ml })
    setExpandSip(false)
  }

  const handleCustomSip = () => {
    const input = window.prompt('输入饮水量 (ml)', String(currentSip))
    if (input) {
      const val = parseInt(input, 10)
      if (val > 0 && val <= 2000) {
        window.hydrabit.updateSettings({ sipAmountMl: val })
      }
    }
    setExpandSip(false)
  }

  const handleReminderChange = (threshold: number) => {
    window.hydrabit.updateSettings({ keyThreshold: threshold })
    setExpandReminder(false)
  }

  const handleCustomReminder = () => {
    const input = window.prompt('输入按键阈值', String(currentThreshold))
    if (input) {
      const val = parseInt(input, 10)
      if (val > 0 && val <= 50000) {
        window.hydrabit.updateSettings({ keyThreshold: val })
      }
    }
    setExpandReminder(false)
  }

  const handleTogglePause = () => {
    window.hydrabit.updateSettings({ paused: !isPaused })
  }

  return (
    <div className="pet-menu-overlay" onClick={onClose}>
      <div className="pet-menu" onClick={(e) => e.stopPropagation()}>
        <div className="pet-menu-arrow" />

        <button type="button" className="pet-menu-item pet-menu-primary" onClick={() => { onRefill(); onClose() }}>
          <span className="pet-menu-icon">💧</span>
          <span>喝一口</span>
        </button>

        <div className="pet-menu-sep" />

        <button
          type="button"
          className="pet-menu-item"
          onClick={() => { setExpandSip(!expandSip); setExpandReminder(false) }}
        >
          <span className="pet-menu-icon">🫗</span>
          <span>饮水量</span>
          <span className="pet-menu-badge">{currentSip}ml</span>
          <span className={`pet-menu-arrow-r ${expandSip ? 'open' : ''}`}>▸</span>
        </button>
        {expandSip && (
          <div className="pet-menu-sub">
            {SIP_PRESETS.map(ml => (
              <button
                key={ml}
                type="button"
                className={`pet-menu-sub-item ${ml === currentSip ? 'active' : ''}`}
                onClick={() => handleSipChange(ml)}
              >
                {ml}ml
              </button>
            ))}
            <button type="button" className="pet-menu-sub-item" onClick={handleCustomSip}>
              自定义...
            </button>
          </div>
        )}

        <button
          type="button"
          className="pet-menu-item"
          onClick={() => { setExpandReminder(!expandReminder); setExpandSip(false) }}
        >
          <span className="pet-menu-icon">⏱</span>
          <span>提醒</span>
          <span className="pet-menu-badge">{reminderLabel}</span>
          <span className={`pet-menu-arrow-r ${expandReminder ? 'open' : ''}`}>▸</span>
        </button>
        {expandReminder && (
          <div className="pet-menu-sub">
            {REMINDER_PRESETS.map(p => (
              <button
                key={p.threshold}
                type="button"
                className={`pet-menu-sub-item ${p.threshold === currentThreshold ? 'active' : ''}`}
                onClick={() => handleReminderChange(p.threshold)}
              >
                {p.label} ({p.threshold}次)
              </button>
            ))}
            <button type="button" className="pet-menu-sub-item" onClick={handleCustomReminder}>
              自定义...
            </button>
          </div>
        )}

        <div className="pet-menu-sep" />

        <button type="button" className="pet-menu-item" onClick={handleTogglePause}>
          <span className="pet-menu-icon">{isPaused ? '▶' : '⏸'}</span>
          <span>{isPaused ? '恢复' : '暂停'}</span>
        </button>

        <button type="button" className="pet-menu-item" onClick={onToggleAnimations}>
          <span className="pet-menu-icon">✨</span>
          <span>动画: {animationsEnabled ? '开' : '关'}</span>
        </button>

        <div className="pet-menu-sep" />

        <button type="button" className="pet-menu-item" onClick={() => { onOpenSettings(); onClose() }}>
          <span className="pet-menu-icon">⚙</span>
          <span>详细设置</span>
        </button>

        <button type="button" className="pet-menu-item" onClick={() => { onMinimize(); onClose() }}>
          <span className="pet-menu-icon">📦</span>
          <span>最小化</span>
        </button>

        <button type="button" className="pet-menu-item pet-menu-danger" onClick={() => { onQuit(); onClose() }}>
          <span className="pet-menu-icon">✕</span>
          <span>关闭</span>
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════
   SettingsPanel — 5-tab detailed settings
   ════════════════════════════════════════ */
type SettingsTab = 'basic' | 'hotkey' | 'display' | 'reminder' | 'data'

function SettingsPanel({
  state,
  onClose,
  animationsEnabled,
  onToggleAnimations
}: {
  state: AppState
  onClose: () => void
  animationsEnabled: boolean
  onToggleAnimations: () => void
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic')
  const [sipInput, setSipInput] = useState(String(state.settings.sipAmountMl))
  const [goalInput, setGoalInput] = useState(String(state.settings.dailyGoalMl))
  const [thresholdInput, setThresholdInput] = useState(String(state.settings.keyThreshold))
  const [historyData, setHistoryData] = useState<{ days: Array<{ date: string; waterCount: number; waterMl: number; goalMet: boolean }>; streak: number }>({ days: [], streak: 0 })
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [hotkeyRecording, setHotkeyRecording] = useState(false)
  const [hotkeyError, setHotkeyError] = useState('')

  useEffect(() => {
    setSipInput(String(state.settings.sipAmountMl))
    setGoalInput(String(state.settings.dailyGoalMl))
    setThresholdInput(String(state.settings.keyThreshold))
  }, [state.settings.sipAmountMl, state.settings.dailyGoalMl, state.settings.keyThreshold])

  useEffect(() => {
    if (activeTab === 'data') {
      window.hydrabit.getHistory().then(setHistoryData)
    }
  }, [activeTab])

  // Hotkey recording
  useEffect(() => {
    if (!hotkeyRecording) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Build accelerator string
      const parts: string[] = []
      if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')

      // Ignore bare modifier presses
      const key = e.key
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return

      // Map key names
      const keyMap: Record<string, string> = {
        'Control': '', 'Shift': '', 'Alt': '', 'Meta': '',
        ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
        'ArrowLeft': 'Left', 'ArrowRight': 'Right',
        'Escape': '', 'Enter': 'Enter', 'Backspace': 'Backspace',
        'Delete': 'Delete', 'Tab': 'Tab'
      }
      const mapped = keyMap[key] ?? key.toUpperCase()

      if (parts.length === 0 || !mapped) {
        setHotkeyError('请至少按一个修饰键 (Ctrl/Cmd/Alt/Shift)')
        return
      }

      const accelerator = [...parts, mapped].join('+')

      // Test the hotkey
      window.hydrabit.testHotkey(accelerator).then(result => {
        if (result.ok) {
          window.hydrabit.setHotkey(accelerator).then(res => {
            if (res.ok) {
              setHotkeyRecording(false)
              setHotkeyError('')
            } else {
              setHotkeyError(res.error ?? '注册失败')
            }
          })
        } else {
          setHotkeyError(result.error ?? '快捷键冲突')
        }
      })
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [hotkeyRecording])

  const handleSaveSip = () => {
    const val = parseInt(sipInput, 10)
    if (val > 0 && val <= 2000) {
      window.hydrabit.updateSettings({ sipAmountMl: val })
    }
  }

  const handleSaveGoal = () => {
    const val = parseInt(goalInput, 10)
    if (val > 0 && val <= 10000) {
      window.hydrabit.updateSettings({ dailyGoalMl: val })
    }
  }

  const handleSaveThreshold = () => {
    const val = parseInt(thresholdInput, 10)
    if (val > 0 && val <= 50000) {
      window.hydrabit.updateSettings({ keyThreshold: val })
    }
  }

  const handleClearToday = () => {
    window.hydrabit.clearToday().then(() => {
      setConfirmClear(false)
      window.hydrabit.getState().then(() => {})
    })
  }

  const handleResetAll = () => {
    window.hydrabit.resetAll().then(() => {
      setConfirmReset(false)
      onToggleAnimations() // Ensure animations reset
    })
  }

  const tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'basic', label: '基础', icon: '🔧' },
    { key: 'hotkey', label: '快捷键', icon: '⌨' },
    { key: 'display', label: '桌宠', icon: '🐾' },
    { key: 'reminder', label: '提醒', icon: '🔔' },
    { key: 'data', label: '数据', icon: '📊' }
  ]

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <span>⚙ 设置</span>
          <button type="button" className="settings-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div className="settings-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              className={`settings-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <span className="settings-tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="settings-body">

          {/* ═══ Tab: Basic ═══ */}
          {activeTab === 'basic' && (
            <div className="settings-section">
              <div className="settings-row">
                <label className="settings-label">每次饮水量</label>
                <div className="settings-input-group">
                  <input
                    className="settings-input"
                    type="number"
                    min={1}
                    max={2000}
                    value={sipInput}
                    placeholder="ml"
                    title="每次饮水量 (ml)"
                    onChange={(e) => setSipInput(e.target.value)}
                    onBlur={handleSaveSip}
                  />
                  <span className="settings-unit">ml</span>
                </div>
              </div>

              <div className="settings-row">
                <label className="settings-label">每日目标</label>
                <div className="settings-input-group">
                  <input
                    className="settings-input"
                    type="number"
                    min={1}
                    max={10000}
                    value={goalInput}
                    placeholder="ml"
                    title="每日目标饮水量 (ml)"
                    onChange={(e) => setGoalInput(e.target.value)}
                    onBlur={handleSaveGoal}
                  />
                  <span className="settings-unit">ml</span>
                </div>
              </div>

              <div className="settings-row">
                <label className="settings-label">耗水阈值</label>
                <div className="settings-input-group">
                  <input
                    className="settings-input"
                    type="number"
                    min={1}
                    max={50000}
                    value={thresholdInput}
                    placeholder="次"
                    title="打字耗水阈值 (次按键)"
                    onChange={(e) => setThresholdInput(e.target.value)}
                    onBlur={handleSaveThreshold}
                  />
                  <span className="settings-unit">次</span>
                </div>
              </div>

              <div className="settings-divider" />

              <div className="settings-row">
                <label className="settings-label">补水 HUD</label>
                <button
                  type="button"
                  className={`settings-toggle ${state.settings.showHud ? 'on' : 'off'}`}
                  onClick={() => window.hydrabit.updateSettings({ showHud: !state.settings.showHud })}
                >
                  {state.settings.showHud ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="settings-row">
                <label className="settings-label">漏水特效</label>
                <button
                  type="button"
                  className={`settings-toggle ${state.settings.leakEffect ? 'on' : 'off'}`}
                  onClick={() => window.hydrabit.updateSettings({ leakEffect: !state.settings.leakEffect })}
                >
                  {state.settings.leakEffect ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="settings-row">
                <label className="settings-label">浮动动画</label>
                <button
                  type="button"
                  className={`settings-toggle ${state.settings.floatAnimation ? 'on' : 'off'}`}
                  onClick={() => {
                    window.hydrabit.updateSettings({ floatAnimation: !state.settings.floatAnimation })
                    onToggleAnimations()
                  }}
                >
                  {state.settings.floatAnimation ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="settings-row">
                <label className="settings-label">动画效果</label>
                <button
                  type="button"
                  className={`settings-toggle ${animationsEnabled ? 'on' : 'off'}`}
                  onClick={onToggleAnimations}
                >
                  {animationsEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="settings-row">
                <label className="settings-label">开机启动</label>
                <button
                  type="button"
                  className={`settings-toggle ${state.settings.autoLaunch ? 'on' : 'off'}`}
                  onClick={() => window.hydrabit.updateSettings({ autoLaunch: !state.settings.autoLaunch })}
                >
                  {state.settings.autoLaunch ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ Tab: Hotkey ═══ */}
          {activeTab === 'hotkey' && (
            <div className="settings-section">
              <div className="settings-hint">当前快捷键</div>
              <div className="settings-hotkey-display">
                {formatHotkey(state.settings.hotkey)}
              </div>

              {!hotkeyRecording ? (
                <button
                  type="button"
                  className="settings-hotkey-record"
                  onClick={() => { setHotkeyRecording(true); setHotkeyError('') }}
                >
                  点击录制新快捷键
                </button>
              ) : (
                <div className="settings-hotkey-active">
                  <div className="settings-hotkey-pulse" />
                  <span>请按下快捷键组合...</span>
                  <button
                    type="button"
                    className="settings-hotkey-cancel"
                    onClick={() => { setHotkeyRecording(false); setHotkeyError('') }}
                  >
                    取消
                  </button>
                </div>
              )}

              {hotkeyError && (
                <div className="settings-hotkey-error">{hotkeyError}</div>
              )}

              <div className="settings-divider" />

              <div className="settings-hint">
                默认: {HOTKEY_PLATFORM} + Shift + W
              </div>
              <div className="settings-hint" style={{ marginTop: '4px' }}>
                快捷键在任何应用中都可触发补水。
              </div>
            </div>
          )}

          {/* ═══ Tab: Display ═══ */}
          {activeTab === 'display' && (
            <div className="settings-section">
              <div className="settings-row">
                <label className="settings-label">始终置顶</label>
                <button
                  type="button"
                  className={`settings-toggle ${state.settings.alwaysOnTop ? 'on' : 'off'}`}
                  onClick={() => window.hydrabit.setAlwaysOnTop(!state.settings.alwaysOnTop)}
                >
                  {state.settings.alwaysOnTop ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="settings-row">
                <label className="settings-label">锁定位置</label>
                <button
                  type="button"
                  className={`settings-toggle ${state.settings.lockPosition ? 'on' : 'off'}`}
                  onClick={() => window.hydrabit.setLockPosition(!state.settings.lockPosition)}
                >
                  {state.settings.lockPosition ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="settings-row">
                <label className="settings-label">透明背景</label>
                <button
                  type="button"
                  className={`settings-toggle ${state.settings.transparentBg ? 'on' : 'off'}`}
                  onClick={() => window.hydrabit.setTransparentBg(!state.settings.transparentBg)}
                >
                  {state.settings.transparentBg ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="settings-divider" />

              <div className="settings-group-label">桌宠尺寸</div>
              <div className="settings-radio-group">
                {(['small', 'medium', 'large'] as PetSize[]).map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`settings-radio ${state.settings.petSize === size ? 'active' : ''}`}
                    onClick={() => window.hydrabit.setPetSize(size)}
                  >
                    {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                  </button>
                ))}
              </div>

              <div className="settings-divider" />

              <div className="settings-group-label">显示位置</div>
              <div className="settings-radio-group settings-radio-grid">
                {([
                  { key: 'top-left', label: '↖' },
                  { key: 'top-right', label: '↗' },
                  { key: 'bottom-left', label: '↙' },
                  { key: 'bottom-right', label: '↘' },
                  { key: 'free', label: '自由' }
                ] as { key: PositionPreset; label: string }[]).map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className={`settings-radio ${state.settings.positionPreset === p.key ? 'active' : ''}`}
                    onClick={() => window.hydrabit.setPosition(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Tab: Reminder ═══ */}
          {activeTab === 'reminder' && (
            <div className="settings-section">
              <div className="settings-group-label">提醒方式</div>
              <div className="settings-mode-list">
                {([
                  { key: 'quiet' as ReminderMode, label: '安静模式', desc: '只改变水量，不抖动' },
                  { key: 'standard' as ReminderMode, label: '标准模式', desc: '低水量时轻微漏水和晃动' },
                  { key: 'lively' as ReminderMode, label: '活泼模式', desc: '更多气泡、抖动和小特效' }
                ]).map(m => (
                  <button
                    key={m.key}
                    type="button"
                    className={`settings-mode-item ${state.settings.reminderMode === m.key ? 'active' : ''}`}
                    onClick={() => window.hydrabit.updateSettings({ reminderMode: m.key })}
                  >
                    <span className="settings-mode-dot" />
                    <span className="settings-mode-label">{m.label}</span>
                    <span className="settings-mode-desc">{m.desc}</span>
                  </button>
                ))}
              </div>
              <div className="settings-divider" />
              <div className="settings-hint">所有模式都不会使用系统弹窗通知。</div>
            </div>
          )}

          {/* ═══ Tab: Data ═══ */}
          {activeTab === 'data' && (
            <div className="settings-section">
              {/* Today's stats */}
              <div className="settings-stats">
                <div className="settings-stat">
                  <span>今日已喝</span>
                  <span>{state.dailyStats.waterMl} ml</span>
                </div>
                <div className="settings-stat">
                  <span>饮水次数</span>
                  <span>{state.dailyStats.waterCount} 次</span>
                </div>
                <div className="settings-stat">
                  <span>目标进度</span>
                  <span>{Math.min(100, Math.round(state.dailyStats.waterMl / state.settings.dailyGoalMl * 100))}%</span>
                </div>
                <div className="settings-stat">
                  <span>连续达标</span>
                  <span>{historyData.streak} 天</span>
                </div>
              </div>

              <div className="settings-divider" />

              {/* 7-day history */}
              <div className="settings-group-label">最近 7 天</div>
              {historyData.days.length > 0 ? (
                <div className="settings-history">
                  {historyData.days.map(day => (
                    <div key={day.date} className="settings-history-row">
                      <span className="settings-history-date">{day.date.slice(5)}</span>
                      <span className="settings-history-ml">{day.waterMl}ml</span>
                      <span className="settings-history-count">{day.waterCount}次</span>
                      <span className={`settings-history-goal ${day.goalMet ? 'met' : ''}`}>
                        {day.goalMet ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="settings-hint">暂无历史记录</div>
              )}

              <div className="settings-divider" />

              {/* Clear today */}
              <div className="settings-action-row">
                {!confirmClear ? (
                  <button
                    type="button"
                    className="settings-action-btn"
                    onClick={() => setConfirmClear(true)}
                  >
                    清除今日记录
                  </button>
                ) : (
                  <div className="settings-confirm-row">
                    <span className="settings-confirm-text">确定清除？</span>
                    <button type="button" className="settings-confirm-yes" onClick={handleClearToday}>确定</button>
                    <button type="button" className="settings-confirm-no" onClick={() => setConfirmClear(false)}>取消</button>
                  </div>
                )}
              </div>

              {/* Reset all */}
              <div className="settings-action-row">
                {!confirmReset ? (
                  <button
                    type="button"
                    className="settings-action-btn settings-danger"
                    onClick={() => setConfirmReset(true)}
                  >
                    重置全部数据
                  </button>
                ) : (
                  <div className="settings-confirm-row">
                    <span className="settings-confirm-text">不可恢复！</span>
                    <button type="button" className="settings-confirm-yes settings-danger" onClick={handleResetAll}>确定重置</button>
                    <button type="button" className="settings-confirm-no" onClick={() => setConfirmReset(false)}>取消</button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════
   Main App
   ════════════════════════════════════════ */
function App() {
  const [state, setState] = useState<AppState>(fallbackState)
  const [hudOpen, setHudOpen] = useState(false)
  const [petMenuOpen, setPetMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isRefilling, setIsRefilling] = useState(false)

  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    return localStorage.getItem('hb-animations') !== 'off'
  })

  const hudOnly = new URLSearchParams(window.location.search).get('hud') === '1'

  const mouseDownRef = useRef<{ x: number; y: number; time: number } | null>(null)

  useEffect(() => {
    localStorage.setItem('hb-animations', animationsEnabled ? 'on' : 'off')
  }, [animationsEnabled])

  useEffect(() => {
    document.body.classList.toggle('no-anim', !animationsEnabled)
  }, [animationsEnabled])

  useEffect(() => {
    window.hydrabit.getState().then(setState)
    const offState = window.hydrabit.onState(setState)
    const offHud = window.hydrabit.onHud(() => setHudOpen(true))
    return () => { offState(); offHud() }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (hudOpen && event.key === 'Enter') {
        event.preventDefault()
        setIsRefilling(true)
        window.hydrabit.confirmWater().then(setState)
        setHudOpen(false)
        setTimeout(() => setIsRefilling(false), 600)
        return
      }
      if (hudOpen && event.key === 'Escape') {
        event.preventDefault()
        setHudOpen(false)
        window.hydrabit.cancelHud()
        return
      }
      if (!hudOnly) {
        window.hydrabit.addKeyPress().then(setState)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hudOpen, hudOnly])

  useEffect(() => {
    if (!petMenuOpen && !settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPetMenuOpen(false)
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [petMenuOpen, settingsOpen])

  const progress = useMemo(() => {
    return Math.min(1, state.dailyStats.keyCount / state.settings.keyThreshold)
  }, [state.dailyStats.keyCount, state.settings.keyThreshold])

  const handleRefill = useCallback(() => {
    setIsRefilling(true)
    window.hydrabit.confirmWater().then(setState)
    setTimeout(() => setIsRefilling(false), 600)
  }, [])

  const handleToggleAnimations = useCallback(() => {
    setAnimationsEnabled((v) => !v)
  }, [])

  const handleMinimize = useCallback(() => {
    window.hydrabit.minimizeToTray()
  }, [])

  const handleQuit = useCallback(() => {
    window.hydrabit.quitApp()
  }, [])

  const handlePetMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    mouseDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [])

  const handlePetMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const down = mouseDownRef.current
    mouseDownRef.current = null
    if (!down) return

    const dx = e.clientX - down.x
    const dy = e.clientY - down.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const elapsed = Date.now() - down.time

    if (dist < 5 && elapsed < 300) {
      setPetMenuOpen((v) => !v)
      setSettingsOpen(false)
    }
  }, [])

  if (hudOnly) {
    return (
      <main className="hud-shell">
        <Hud amount={state.settings.sipAmountMl} />
      </main>
    )
  }

  return (
    <main className="widget-shell">
      <section className={`widget ${!animationsEnabled ? 'no-anim' : ''}`}>
        <div
          onMouseDown={handlePetMouseDown}
          onMouseUp={handlePetMouseUp}
          style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}
        >
          <Pet
            progress={progress}
            animationsEnabled={animationsEnabled}
            isRefilling={isRefilling}
            isPaused={state.settings.paused}
            reminderMode={state.settings.reminderMode}
            leakEffect={state.settings.leakEffect}
          />
        </div>
      </section>

      {state.settings.showHud && hudOpen && <Hud amount={state.settings.sipAmountMl} />}

      {petMenuOpen && (
        <PetMenu
          state={state}
          onRefill={handleRefill}
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={() => setPetMenuOpen(false)}
          onMinimize={handleMinimize}
          onQuit={handleQuit}
          animationsEnabled={animationsEnabled}
          onToggleAnimations={handleToggleAnimations}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          state={state}
          onClose={() => setSettingsOpen(false)}
          animationsEnabled={animationsEnabled}
          onToggleAnimations={handleToggleAnimations}
        />
      )}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
