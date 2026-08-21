import { createId } from '../lib/id'
import { sendUserEmail, welcomeEmailBody } from '../lib/email'
import * as db from './db'
import type { UserProfile } from './types'

const SESSION_KEY = 'hold_auth_session'

export async function getCurrentUser(): Promise<UserProfile | null> {
  const session = localStorage.getItem(SESSION_KEY)
  if (!session) return null
  return db.getUser()
}

export async function signIn(input: {
  displayName: string
  email: string
}): Promise<{ user: UserProfile; emailStatus: string }> {
  const existing = await db.getUser()
  const now = Date.now()
  const isNew = !existing
  const user: UserProfile = existing
    ? {
        ...existing,
        displayName: input.displayName.trim(),
        email: input.email.trim().toLowerCase(),
      }
    : {
        id: createId('user'),
        displayName: input.displayName.trim(),
        email: input.email.trim().toLowerCase(),
        createdAt: now,
      }
  await db.saveUser(user)
  localStorage.setItem(SESSION_KEY, user.id)

  const mail = await sendUserEmail({
    to: user.email,
    subject: isNew ? 'Welcome to HOLD' : 'HOLD — signed in',
    message: welcomeEmailBody(user.displayName),
  })

  return {
    user,
    emailStatus: mail.ok
      ? mail.detail
      : `Could not send email yet: ${mail.detail}`,
  }
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(SESSION_KEY)
}

export function isSignedInSync(): boolean {
  return Boolean(localStorage.getItem(SESSION_KEY))
}
