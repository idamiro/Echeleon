/**
 * Transactional mail via FormSubmit (no backend key).
 * First email to a new address requires one inbox confirmation click.
 */
export async function sendUserEmail(args: {
  to: string
  subject: string
  message: string
}): Promise<{ ok: boolean; detail: string }> {
  const to = args.to.trim().toLowerCase()
  if (!to.includes('@')) {
    return { ok: false, detail: 'Invalid email' }
  }

  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _subject: args.subject,
        message: args.message,
        from: 'HOLD by Vulcet',
        _template: 'box',
        _captcha: 'false',
        _honey: '',
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, detail: text || `HTTP ${res.status}` }
    }

    return {
      ok: true,
      detail:
        'Email queued. If this is your first HOLD mail, confirm the activation link FormSubmit sent you.',
    }
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : 'Network error sending email',
    }
  }
}

export function holdStartedEmailBody(args: {
  name: string
  product: string
  priceLabel: string
  endsAt: number
  days: number
}): string {
  return [
    `Hi ${args.name},`,
    '',
    `Your HOLD is active for: ${args.product} (${args.priceLabel}).`,
    `Waiting period: ${args.days === 1 ? '24 hours' : `${args.days} days`}.`,
    `Revisit after: ${new Date(args.endsAt).toLocaleString()}.`,
    '',
    'Open HOLD on Vulcet to decide when the timer ends.',
    '— HOLD · Vulcet',
  ].join('\n')
}

export function welcomeEmailBody(name: string): string {
  return [
    `Hi ${name},`,
    '',
    'Welcome to HOLD. Your account is saved in this browser.',
    'You will get a message when you start a HOLD, and when you decide.',
    '',
    'If this is the first email from HOLD, click FormSubmit’s confirmation link once so future messages arrive.',
    '',
    '— HOLD · Vulcet',
  ].join('\n')
}

export function decisionEmailBody(args: {
  name: string
  product: string
  decision: string
  moneyNote?: string
}): string {
  return [
    `Hi ${args.name},`,
    '',
    `Decision recorded for ${args.product}: ${args.decision}.`,
    args.moneyNote || '',
    '',
    '— HOLD · Vulcet',
  ]
    .filter(Boolean)
    .join('\n')
}
