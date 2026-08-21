import { useCallback, useRef, useState } from 'react'

interface HoldPressButtonProps {
  label?: string
  holdMs?: number
  disabled?: boolean
  onComplete: () => void | Promise<void>
}

/** Press-and-hold CTA with liquid glass fill */
export function HoldPressButton({
  label = 'Hold to start HOLD',
  holdMs = 1200,
  disabled,
  onComplete,
}: HoldPressButtonProps) {
  const [progress, setProgress] = useState(0)
  const [armed, setArmed] = useState(false)
  const raf = useRef<number | null>(null)
  const start = useRef(0)
  const done = useRef(false)

  const stop = useCallback((reset: boolean) => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
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
        void onComplete()
      }
      return
    }
    raf.current = requestAnimationFrame(tick)
  }, [holdMs, onComplete])

  const begin = useCallback(() => {
    if (disabled) return
    done.current = false
    start.current = performance.now()
    setArmed(false)
    raf.current = requestAnimationFrame(tick)
  }, [disabled, tick])

  const end = useCallback(() => {
    if (done.current) return
    stop(true)
  }, [stop])

  return (
    <button
      type="button"
      className={`hold-press${armed ? ' is-armed' : ''}${disabled ? ' is-disabled' : ''}`}
      disabled={disabled}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        begin()
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className="hold-press-fill"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />
      <span className="hold-press-ring" style={{ ['--p' as string]: String(progress) }} />
      <span className="hold-press-label">
        {progress > 0.02 && progress < 1
          ? 'Keep holding…'
          : progress >= 1
            ? 'Locked in'
            : label}
      </span>
    </button>
  )
}
