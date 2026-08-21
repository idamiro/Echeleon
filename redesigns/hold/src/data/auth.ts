import { createId } from '../lib/id'
import * as db from './db'
import type { UserProfile } from './types'

const SESSION_KEY = 'hold_auth_session'

/**
 * Auth is local-first for MVP (static deploy).
 * Gate only when the user first tries to persist a HOLD.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const session = localStorage.getItem(SESSION_KEY)
  if (!session) return null
  return db.getUser()
}

export async function signIn(input: {
  displayName: string
  email: string
}): Promise<UserProfile> {
  const existing = await db.getUser()
  const now = Date.now()
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
  return user
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(SESSION_KEY)
}

export function isSignedInSync(): boolean {
  return Boolean(localStorage.getItem(SESSION_KEY))
}
