import React, { useEffect, useMemo, useState } from 'react'
import type { AppState, DailyHistory } from '../../shared/types'

type HistoryData = {
  days: DailyHistory[]
  streak: number
}

type DataPanelProps = {
  state: AppState
  panelRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}

const shortWeekday = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date).replace('周', '')
}

const getLastSevenDays = () => {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })
}

export function DataPanel({ state, panelRef, onClose }: DataPanelProps) {
  const [history, setHistory] = useState<HistoryData>({ days: [], streak: 0 })

  useEffect(() => {
    window.hydrabit.getHistory().then(setHistory)
  }, [state.dailyStats.waterCount, state.dailyStats.waterMl])

  const progress = Math.min(100, Math.round((state.dailyStats.waterMl / state.settings.dailyGoalMl) * 100))
  const recentLogs = [...(state.dailyStats.waterLogs ?? [])].slice(-5).reverse()
  const chartDays = useMemo(() => {
    const byDate = new Map(history.days.map((day) => [day.date, day]))
    return getLastSevenDays().map((date) => ({
      date,
      waterMl: byDate.get(date)?.waterMl ?? (date === state.dailyStats.date ? state.dailyStats.waterMl : 0)
    }))
  }, [history.days, state.dailyStats.date, state.dailyStats.waterMl])
  const maxMl = Math.max(state.settings.dailyGoalMl, ...chartDays.map((day) => day.waterMl), 1)

  return (
    <div className="data-overlay">
      <section ref={panelRef} className="data-panel">
        <header className="data-header">
          <span>饮水数据</span>
          <button type="button" className="data-close" onClick={onClose}>×</button>
        </header>

        <div className="data-section">
          <div className="data-section-title">今日饮水概览</div>
          <div className="data-summary">
            <div>
              <span>已喝</span>
              <strong>{state.dailyStats.waterMl}ml</strong>
            </div>
            <div>
              <span>次数</span>
              <strong>{state.dailyStats.waterCount} 次</strong>
            </div>
            <div>
              <span>目标</span>
              <strong>{state.settings.dailyGoalMl}ml</strong>
            </div>
          </div>
          <div className="data-waterbar" aria-label={`今日完成 ${progress}%`}>
            <div className="data-waterbar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="data-section">
          <div className="data-section-title">最近记录</div>
          {recentLogs.length > 0 ? (
            <div className="data-log-list">
              {recentLogs.map((log, index) => (
                <div key={`${log.time}-${index}`} className="data-log-row">
                  <span>{log.time}</span>
                  <strong>+{log.amountMl}ml</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="data-empty">今天还没有喝水</div>
          )}
        </div>

        <div className="data-section">
          <div className="data-section-title">最近 7 天</div>
          <div className="data-bars">
            {chartDays.map((day) => {
              const isToday = day.date === state.dailyStats.date
              const height = Math.max(4, Math.round((day.waterMl / maxMl) * 68))
              return (
                <div key={day.date} className={`data-bar-day ${isToday ? 'today' : ''}`}>
                  <div className="data-bar-track">
                    <div className="data-bar-fill" style={{ height }} />
                  </div>
                  <span>{shortWeekday(day.date)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
