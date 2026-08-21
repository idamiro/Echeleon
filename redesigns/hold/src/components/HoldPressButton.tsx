import { useCallback, useRef, useState } from 'react'

interface HoldPressButtonProps {
  label?: string
  holdMs?: number
  disabled?: boolean
  onComplete: () => void | Promise<void>
}

/** Press-and-hold CTA — radial liquid fill + ring progress */
export function HoldPressButton({
  label = 'Hold to lock HOLD',
  holdMs = 1400,
  disabled,
  onComplete,
}: HoldPressButtonProps) {
  const [progress, setProgress] = useState(0)
  const [armed, setArmed] = useState(false)
  const [pressing, setPressing] = useState(false)
  const raf = useRef<number | null>(null)
  const start = useRef(0)
  const done = useRef(false)

  const stop = useCallback((reset: boolean) => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
    setPressing(false)
    if (reset) {
      setProgress(0)
      setArmed(false)
      done.current = false
    }
  }, [])

  const tick = useCallback(() => {
    const p = Math.min(1, (performance.now() - start.current) / holdMs)
    setProgress(p)
    if (p >= 1) {
      if (!done.current) {
        done.current = true
        setArmed(true)
        setPressing(false)
        void onComplete()
      }
      return
    }
    raf.current = requestAnimationFrame(tick)
  }, [holdMs, onComplete])

  const begin = useCallback(() => {
    if (disabled) return
    done.current = false
    setPressing(true)
    setArmed(false)
    start.current = performance.now()
    raf.current = requestAnimationFrame(tick)
  }, [disabled, tick])

  const end = useCallback(() => {
    if (done.current) return
    stop(true)
  }, [stop])

  const r = 42
  const c = 2 * Math.PI * r
  const dash = c * progress

  return (
    <button
      type="button"
      className={`hold-press${pressing ? ' is-pressing' : ''}${armed ? ' is-armed' : ''}${disabled ? ' is-disabled' : ''}`}
      disabled={disabled}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        begin()
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className="hold-press-radial"
        style={{
          background: `radial-gradient(circle at center, rgba(255,255,255,${0.15 + progress * 0.55}) 0%, rgba(255,255,255,${0.02 + progress * 0.12}) ${40 + progress * 60}%, transparent 70%)`,
        }}
        aria-hidden="true"
      />
      <svg className="hold-press-svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="hold-press-track" cx="50" cy="50" r={r} fill="none" />
        <circle
          className="hold-press-arc"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="hold-press-label">
        {progress > 0.02 && progress < 1
          ? `${Math.round(progress * 100)}%`
          : progress >= 1
            ? 'Locked'
            : label}
      </span>
    </button>
  )
}
