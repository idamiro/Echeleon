export function formatRelativeRemaining(endsAt: number, now = Date.now()): {
  expired: boolean
  label: string
  msLeft: number
} {
  const msLeft = endsAt - now
  if (msLeft <= 0) {
    return { expired: true, label: 'Hold ended', msLeft: 0 }
  }
  const sec = Math.floor(msLeft / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  if (days > 0) {
    return {
      expired: false,
      label: `${days}d ${hours}h remaining`,
      msLeft,
    }
  }
  if (hours > 0) {
    return {
      expired: false,
      label: `${hours}h ${mins}m remaining`,
      msLeft,
    }
  }
  return {
    expired: false,
    label: `${Math.max(1, mins)}m remaining`,
    msLeft,
  }
}

export function addDays(fromMs: number, days: number): number {
  return fromMs + days * 24 * 60 * 60 * 1000
}
