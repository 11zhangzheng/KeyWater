import React, { useLayoutEffect, useState } from 'react'
import type { AppState } from '../../shared/types'
import { calculateMenuLayout, type MenuLayout, type MenuPlacement } from './menuLayout'

const SIP_PRESETS = [150, 200, 250, 300, 500]

const REMINDER_PRESETS = [
  { label: '轻', threshold: 3000 },
  { label: '标准', threshold: 2000 },
  { label: '频繁', threshold: 1000 }
]

const getReminderLabel = (threshold: number) => {
  return REMINDER_PRESETS.find((preset) => preset.threshold === threshold)?.label ?? '自定义'
}

type PetMenuProps = {
  state: AppState
  anchorRect: DOMRect | null
  menuRef: React.RefObject<HTMLDivElement | null>
  onRefill: () => void
  onOpenData: () => void
  onMinimize: () => void
  onQuit: () => void
}

const initialLayout: MenuLayout = {
  left: 8,
  top: 8,
  maxHeight: 320,
  placement: 'top-left' as MenuPlacement
}

export function PetMenu({
  state,
  anchorRect,
  menuRef,
  onRefill,
  onOpenData,
  onMinimize,
  onQuit
}: PetMenuProps) {
  const [expandSip, setExpandSip] = useState(false)
  const [expandReminder, setExpandReminder] = useState(false)
  const [layout, setLayout] = useState(initialLayout)

  const currentSip = state.settings.sipAmountMl
  const currentThreshold = state.settings.keyThreshold
  const isPaused = state.settings.paused

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu || !anchorRect) return

    setLayout(calculateMenuLayout({
      anchorRect,
      menuWidth: Math.min(220, Math.max(180, menu.offsetWidth || 210)),
      menuHeight: menu.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenHeight: window.screen.availHeight
    }))
  }, [anchorRect, currentSip, currentThreshold, expandReminder, expandSip, menuRef])

  const updateSip = (ml: number) => {
    window.hydrabit.updateSettings({ sipAmountMl: ml })
    setExpandSip(false)
  }

  const updateCustomSip = () => {
    const input = window.prompt('自定义饮水量 (ml)', String(currentSip))
    const value = Number.parseInt(input ?? '', 10)
    if (Number.isFinite(value) && value > 0 && value <= 2000) {
      updateSip(value)
    }
  }

  const updateReminder = (threshold: number) => {
    window.hydrabit.updateSettings({ keyThreshold: threshold })
    setExpandReminder(false)
  }

  const updateCustomReminder = () => {
    const input = window.prompt('自定义按键阈值', String(currentThreshold))
    const value = Number.parseInt(input ?? '', 10)
    if (Number.isFinite(value) && value > 0 && value <= 50000) {
      updateReminder(value)
    }
  }

  return (
    <div className="pet-menu-overlay strict-menu-overlay">
      <div
        ref={menuRef}
        className={`pet-menu strict-menu placement-${layout.placement}`}
        style={{ left: layout.left, top: layout.top, maxHeight: layout.maxHeight }}
      >
        <div className="pet-menu-arrow" aria-hidden="true" />
        <div className="pet-menu-scroll" style={{ maxHeight: layout.maxHeight - 16 }}>
          <button type="button" className="pet-menu-item pet-menu-primary" onClick={onRefill}>
            <span className="pet-menu-icon pet-menu-icon-drop" aria-hidden="true" />
            <span className="pet-menu-label">喝一口</span>
            <span className="pet-menu-right">+{currentSip}ml</span>
          </button>

          <button
            type="button"
            className="pet-menu-item"
            onClick={() => { setExpandSip((value) => !value); setExpandReminder(false) }}
          >
            <span className="pet-menu-icon pet-menu-icon-cup" aria-hidden="true" />
            <span className="pet-menu-label">饮水量</span>
            <span className="pet-menu-right">{currentSip}ml <span className="pet-menu-chevron">›</span></span>
          </button>

          {expandSip && (
            <div className="pet-menu-options">
              {SIP_PRESETS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  className={`pet-menu-option ${ml === currentSip ? 'active' : ''}`}
                  onClick={() => updateSip(ml)}
                >
                  {ml}ml
                </button>
              ))}
              <button type="button" className="pet-menu-option" onClick={updateCustomSip}>
                自定义
              </button>
            </div>
          )}

          <button
            type="button"
            className="pet-menu-item"
            onClick={() => { setExpandReminder((value) => !value); setExpandSip(false) }}
          >
            <span className="pet-menu-icon pet-menu-icon-bell" aria-hidden="true" />
            <span className="pet-menu-label">提醒强度</span>
            <span className="pet-menu-right">{getReminderLabel(currentThreshold)} <span className="pet-menu-chevron">›</span></span>
          </button>

          {expandReminder && (
            <div className="pet-menu-options">
              {REMINDER_PRESETS.map((preset) => (
                <button
                  key={preset.threshold}
                  type="button"
                  className={`pet-menu-option ${preset.threshold === currentThreshold ? 'active' : ''}`}
                  onClick={() => updateReminder(preset.threshold)}
                >
                  {preset.label}
                </button>
              ))}
              <button type="button" className="pet-menu-option" onClick={updateCustomReminder}>
                自定义
              </button>
            </div>
          )}

          <button type="button" className="pet-menu-item" onClick={() => window.hydrabit.updateSettings({ paused: !isPaused })}>
            <span className="pet-menu-icon pet-menu-icon-pause" aria-hidden="true" />
            <span className="pet-menu-label">{isPaused ? '恢复' : '暂停'}</span>
            <span className="pet-menu-right" />
          </button>

          <button type="button" className="pet-menu-item" onClick={onMinimize}>
            <span className="pet-menu-icon pet-menu-icon-window" aria-hidden="true" />
            <span className="pet-menu-label">最小化</span>
            <span className="pet-menu-right" />
          </button>

          <button type="button" className="pet-menu-item" onClick={onOpenData}>
            <span className="pet-menu-icon pet-menu-icon-data" aria-hidden="true" />
            <span className="pet-menu-label">数据</span>
            <span className="pet-menu-right" />
          </button>

          <button type="button" className="pet-menu-item pet-menu-danger" onClick={onQuit}>
            <span className="pet-menu-icon pet-menu-icon-close" aria-hidden="true" />
            <span className="pet-menu-label">关闭</span>
            <span className="pet-menu-right" />
          </button>
        </div>
      </div>
    </div>
  )
}
