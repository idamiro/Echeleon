/**
 * Transactional HOLD mail via the same Web3Forms pipeline as vulcet.com/contact.
 * Notifications land in studio@vulcet.com; user is CC'd so they get a copy.
 * From-name: HOLD · Vulcet (company channel, not FormSubmit spam).
 */
const WEB3FORMS_KEY = '471f1056-9d23-4678-b1fd-87a01108f652'
const FROM_NAME = 'HOLD · Vulcet'
const REPLY_TO = 'studio@vulcet.com'

export async function sendUserEmail(args: {
  to: string
  subject: string
  message: string
  name?: string
}): Promise<{ ok: boolean; detail: string }> {
  const to = args.to.trim().toLowerCase()
  if (!to.includes('@')) return { ok: false, detail: 'Invalid email' }

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: args.subject,
        from_name: FROM_NAME,
        name: args.name || 'HOLD user',
        email: to,
        replyto: REPLY_TO,
        cc: to,
        message: args.message,
        // Honeypot
        botcheck: '',
      }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      message?: string
    }

    if (!res.ok || data.success === false) {
      return { ok: false, detail: data.message || `HTTP ${res.status}` }
    }

    return {
      ok: true,
      detail: 'Sent via Vulcet mail (studio@vulcet.com channel). Check inbox + spam.',
    }
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : 'Network error',
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
    `Your HOLD is active.`,
    '',
    `Product: ${args.product}`,
    `Price: ${args.priceLabel}`,
    `Wait: ${args.days === 1 ? '24 hours' : `${args.days} days`}`,
    `Revisit after: ${new Date(args.endsAt).toLocaleString()}`,
    '',
    'Open https://vulcet.com/redesigns/hold/ when you are ready to decide.',
    '',
    '— HOLD',
    'Vulcet · studio@vulcet.com',
  ].join('\n')
}

export function welcomeEmailBody(name: string): string {
  return [
    `Hi ${name},`,
    '',
    'Welcome to HOLD — Vulcet’s purchase cooling-off tool.',
    'You will get a message when a HOLD starts and when you decide.',
    '',
    '— HOLD',
    'Vulcet · studio@vulcet.com',
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
    `Decision for ${args.product}: ${args.decision}.`,
    args.moneyNote || '',
    '',
    '— HOLD',
    'Vulcet · studio@vulcet.com',
  ]
    .filter(Boolean)
    .join('\n')
}
