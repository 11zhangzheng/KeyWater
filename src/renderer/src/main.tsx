import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import './styles.css'
import type { AppState, ReminderMode } from '../../shared/types'
import { defaultAppState } from '../../shared/defaults'
import { PetMenu } from './PetMenu'
import { DataPanel } from './DataPanel'

/* ── Fallback state ── */
const fallbackState: AppState = defaultAppState()

/* ── State derivation ── */
type PetState = 'full' | 'normal' | 'thirsty' | 'empty'

function getPetState(progress: number): PetState {
  if (progress >= 0.95) return 'empty'
  if (progress >= 0.8) return 'thirsty'
  if (progress >= 0.4) return 'normal'
  return 'full'
}

/* Pet component */
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

/* Main app */
function App() {
  const [state, setState] = useState<AppState>(fallbackState)
  const [hudOpen, setHudOpen] = useState(false)
  const [petMenuOpen, setPetMenuOpen] = useState(false)
  const [dataPanelOpen, setDataPanelOpen] = useState(false)
  const [isRefilling, setIsRefilling] = useState(false)

  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    return localStorage.getItem('ks-animations') !== 'off'
  })

  const hudOnly = new URLSearchParams(window.location.search).get('hud') === '1'

  const mouseDownRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const petHitboxRef = useRef<HTMLDivElement>(null)
  const petMenuRef = useRef<HTMLDivElement>(null)
  const dataPanelRef = useRef<HTMLElement>(null)
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    localStorage.setItem('ks-animations', animationsEnabled ? 'on' : 'off')
  }, [animationsEnabled])

  useEffect(() => {
    document.body.classList.toggle('no-anim', !animationsEnabled)
  }, [animationsEnabled])

  useEffect(() => {
    window.keysip.getState().then(setState)
    const offState = window.keysip.onState(setState)
    const offOpenDataPanel = window.keysip.onOpenDataPanel(() => {
      setPetMenuOpen(false)
      setDataPanelOpen(true)
    })
    return () => { offState(); offOpenDataPanel() }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (hudOpen && event.key === 'Enter') {
        event.preventDefault()
        setIsRefilling(true)
        window.keysip.confirmWater().then(setState)
        setHudOpen(false)
        setTimeout(() => setIsRefilling(false), 600)
        return
      }
      if (hudOpen && event.key === 'Escape') {
        event.preventDefault()
        setHudOpen(false)
        window.keysip.cancelHud()
        return
      }
      if (!hudOnly) {
        window.keysip.addKeyPress().then(setState)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hudOpen, hudOnly])

  useEffect(() => {
    if (!petMenuOpen && !dataPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPetMenuOpen(false)
        setDataPanelOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [petMenuOpen, dataPanelOpen])

  useEffect(() => {
    if (!petMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (petMenuRef.current?.contains(target)) return
      if (petHitboxRef.current?.contains(target)) return
      setPetMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [petMenuOpen])

  useEffect(() => {
    if (!dataPanelOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (dataPanelRef.current?.contains(target)) return
      if (petHitboxRef.current?.contains(target)) return
      setDataPanelOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [dataPanelOpen])

  useEffect(() => {
    if (!petMenuOpen) return

    const updateAnchor = () => {
      setMenuAnchorRect(petHitboxRef.current?.getBoundingClientRect() ?? null)
    }

    updateAnchor()
    window.addEventListener('resize', updateAnchor)
    return () => window.removeEventListener('resize', updateAnchor)
  }, [petMenuOpen])

  useEffect(() => {
    if (hudOnly) return
    window.keysip.setMenuOpen(petMenuOpen || dataPanelOpen)
  }, [hudOnly, petMenuOpen, dataPanelOpen])

  const progress = useMemo(() => {
    return Math.min(1, state.dailyStats.keyCount / state.settings.keyThreshold)
  }, [state.dailyStats.keyCount, state.settings.keyThreshold])

  const handleRefill = useCallback(() => {
    setIsRefilling(true)
    window.keysip.confirmWater().then(setState)
    setTimeout(() => setIsRefilling(false), 600)
  }, [])

  const handleMinimize = useCallback(() => {
    window.keysip.minimizeToTray()
  }, [])

  const handleQuit = useCallback(() => {
    window.keysip.quitApp()
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
      if (petMenuOpen) {
        setPetMenuOpen(false)
      } else {
        setMenuAnchorRect(petHitboxRef.current?.getBoundingClientRect() ?? null)
        setPetMenuOpen(true)
      }
      setDataPanelOpen(false)
    }
  }, [petMenuOpen])

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
          ref={petHitboxRef}
          onMouseDown={handlePetMouseDown}
          onMouseUp={handlePetMouseUp}
          className="pet-hitbox"
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
          anchorRect={menuAnchorRect}
          menuRef={petMenuRef}
          onRefill={() => { handleRefill(); setPetMenuOpen(false) }}
          onOpenData={() => { setDataPanelOpen(true); setPetMenuOpen(false) }}
          onMinimize={() => { handleMinimize(); setPetMenuOpen(false) }}
          onQuit={handleQuit}
        />
      )}

      {dataPanelOpen && (
        <DataPanel
          state={state}
          panelRef={dataPanelRef}
          onClose={() => setDataPanelOpen(false)}
        />
      )}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)

