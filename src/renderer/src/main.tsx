import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import './styles.css'
import type { AppState } from '../../shared/types'

/* ── Fallback state ── */
const fallbackState: AppState = {
  settings: {
    keyThreshold: 2000,
    sipAmountMl: 250,
    enableSupplements: false,
    paused: false
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
  if (progress >= 0.8) return 'full'
  if (progress >= 0.4) return 'normal'
  if (progress > 0) return 'thirsty'
  return 'empty'
}

/* ════════════════════════════════════════
   Pet Component
   ════════════════════════════════════════ */
function Pet({
  progress,
  animationsEnabled,
  isRefilling
}: {
  progress: number
  animationsEnabled: boolean
  isRefilling: boolean
}) {
  // progress = 0 → empty, 1 → full
  // Water level is inverted: more typing = less water
  const waterPercent = Math.round((1 - progress) * 100)
  const petState = getPetState(progress)

  return (
    <div
      className={[
        'pet',
        `state-${petState}`,
        isRefilling ? 'refilling' : '',
        !animationsEnabled ? 'no-anim' : ''
      ].filter(Boolean).join(' ')}
    >
      <div className="pet-body">
        {/* Water fill layer */}
        <div
          className="water"
          style={{ height: `${waterPercent}%` }}
        >
          <div className="water-sparkle" style={{ left: '20%', bottom: '30%', animationDelay: '0s' }} />
          <div className="water-sparkle" style={{ left: '60%', bottom: '50%', animationDelay: '1.5s' }} />
        </div>

        {/* Face */}
        <div className="face">
          <div className="eye eye-l" />
          <div className="eye eye-r" />
          <div className={`mouth mouth-${petState === 'full' ? 'happy' : petState === 'thirsty' ? 'thirsty' : 'normal'}`} />
          <div className="blush blush-l" />
          <div className="blush blush-r" />
          {/* Thirsty sweat */}
          <div className="sweat" />
          {/* Empty zzz */}
          <div className="zzz">Z</div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════
   HUD Component (SIP confirmation overlay)
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
   Context Menu
   ════════════════════════════════════════ */
interface MenuItem {
  label: string
  action?: () => void
}

function ContextMenu({
  x, y, items, onClose
}: {
  x: number; y: number; items: MenuItem[]; onClose: () => void
}) {
  const adjustedX = Math.min(x, window.innerWidth - 140)
  const adjustedY = Math.min(y, window.innerHeight - items.length * 28)

  return (
    <div className="menu-overlay" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div
        className="context-menu"
        style={{ left: adjustedX, top: adjustedY }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {items.map((item, i) => (
          item.label === '-'
            ? <div key={i} className="menu-sep" />
            : (
              <button
                key={i}
                type="button"
                className="menu-item"
                onClick={() => { item.action?.(); onClose() }}
              >
                <span>{item.label}</span>
              </button>
              )
        ))}
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
  const [menuOpen, setMenuOpen] = useState<{ x: number; y: number } | null>(null)
  const [isRefilling, setIsRefilling] = useState(false)

  // UI preferences
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    return localStorage.getItem('hb-animations') !== 'off'
  })

  const hudOnly = new URLSearchParams(window.location.search).get('hud') === '1'

  // Persist animation pref
  useEffect(() => {
    localStorage.setItem('hb-animations', animationsEnabled ? 'on' : 'off')
  }, [animationsEnabled])

  // Apply animation class
  useEffect(() => {
    document.body.classList.toggle('no-anim', !animationsEnabled)
  }, [animationsEnabled])

  // IPC state sync
  useEffect(() => {
    window.hydrabit.getState().then(setState)
    const offState = window.hydrabit.onState(setState)
    const offHud = window.hydrabit.onHud(() => setHudOpen(true))
    return () => { offState(); offHud() }
  }, [])

  // Keyboard handler
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

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Progress: 0 = no keys typed (full water), 1 = threshold reached (empty water)
  const progress = useMemo(() => {
    return Math.min(1, state.dailyStats.keyCount / state.settings.keyThreshold)
  }, [state.dailyStats.keyCount, state.settings.keyThreshold])

  // Refill handler
  const handleRefill = useCallback(() => {
    setIsRefilling(true)
    window.hydrabit.confirmWater().then(setState)
    setTimeout(() => setIsRefilling(false), 600)
  }, [])

  // Right-click handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen({ x: e.clientX, y: e.clientY })
  }, [])

  // Context menu items
  const contextMenuItems: MenuItem[] = useMemo(() => [
    { label: '+ WATER', action: handleRefill },
    { label: '-' },
    {
      label: animationsEnabled ? 'ANIM: ON' : 'ANIM: OFF',
      action: () => setAnimationsEnabled((v) => !v)
    },
    { label: '-' },
    { label: 'QUIT', action: () => window.close() }
  ], [animationsEnabled, handleRefill])

  // ── HUD-only mode ──
  if (hudOnly) {
    return (
      <main className="hud-shell">
        <Hud amount={state.settings.sipAmountMl} />
      </main>
    )
  }

  // ── Widget mode: just the pet ──
  return (
    <main className="widget-shell">
      <section
        className={`widget ${!animationsEnabled ? 'no-anim' : ''}`}
        onContextMenu={handleContextMenu}
      >
        <Pet
          progress={progress}
          animationsEnabled={animationsEnabled}
          isRefilling={isRefilling}
        />
      </section>

      {hudOpen && <Hud amount={state.settings.sipAmountMl} />}

      {menuOpen && (
        <ContextMenu
          x={menuOpen.x}
          y={menuOpen.y}
          items={contextMenuItems}
          onClose={() => setMenuOpen(null)}
        />
      )}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
