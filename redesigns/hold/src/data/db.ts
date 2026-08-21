import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { tallyMoneyNotSpent } from './money'
import type {
  AssessmentRecord,
  HoldRecord,
  ProductRecord,
  UserProfile,
} from './types'

interface HoldDb extends DBSchema {
  meta: {
    key: string
    value: unknown
  }
  products: {
    key: string
    value: ProductRecord
    indexes: { 'by-updated': number }
  }
  assessments: {
    key: string
    value: AssessmentRecord
    indexes: { 'by-product': string; 'by-created': number }
  }
  holds: {
    key: string
    value: HoldRecord
    indexes: { 'by-product': string; 'by-status': string; 'by-ends': number }
  }
}

const DB_NAME = 'hold-mvp-v1'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<HoldDb>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<HoldDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta')
        }
        if (!db.objectStoreNames.contains('products')) {
          const p = db.createObjectStore('products', { keyPath: 'id' })
          p.createIndex('by-updated', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('assessments')) {
          const a = db.createObjectStore('assessments', { keyPath: 'id' })
          a.createIndex('by-product', 'productId')
          a.createIndex('by-created', 'createdAt')
        }
        if (!db.objectStoreNames.contains('holds')) {
          const h = db.createObjectStore('holds', { keyPath: 'id' })
          h.createIndex('by-product', 'productId')
          h.createIndex('by-status', 'status')
          h.createIndex('by-ends', 'endsAt')
        }
      },
    })
  }
  return dbPromise
}

const USER_KEY = 'user'

export async function getUser(): Promise<UserProfile | null> {
  const db = await getDb()
  const user = await db.get('meta', USER_KEY)
  return (user as UserProfile | undefined) ?? null
}

export async function saveUser(user: UserProfile): Promise<void> {
  const db = await getDb()
  await db.put('meta', user, USER_KEY)
}

export async function clearUser(): Promise<void> {
  const db = await getDb()
  await db.delete('meta', USER_KEY)
}

export async function putProduct(product: ProductRecord): Promise<void> {
  const db = await getDb()
  await db.put('products', product)
}

export async function getProduct(id: string): Promise<ProductRecord | undefined> {
  const db = await getDb()
  return db.get('products', id)
}

export async function listProducts(): Promise<ProductRecord[]> {
  const db = await getDb()
  const all = await db.getAll('products')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function putAssessment(a: AssessmentRecord): Promise<void> {
  const db = await getDb()
  await db.put('assessments', a)
}

export async function getAssessment(id: string): Promise<AssessmentRecord | undefined> {
  const db = await getDb()
  return db.get('assessments', id)
}

export async function listAssessmentsForProduct(
  productId: string
): Promise<AssessmentRecord[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('assessments', 'by-product', productId)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function putHold(hold: HoldRecord): Promise<void> {
  const db = await getDb()
  await db.put('holds', hold)
}

export async function getHold(id: string): Promise<HoldRecord | undefined> {
  const db = await getDb()
  return db.get('holds', id)
}

export async function listHolds(): Promise<HoldRecord[]> {
  const db = await getDb()
  const all = await db.getAll('holds')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function listActiveHolds(now = Date.now()): Promise<HoldRecord[]> {
  const all = await listHolds()
  return all.filter((h) => h.status === 'active' && h.endsAt > now)
}

/**
 * Money not spent — ONLY explicit LET IT GO decisions.
 * Expired / ignored holds never contribute.
 */
export async function sumMoneyNotSpent(): Promise<{
  byCurrency: Record<string, number>
  totalEntries: number
}> {
  const holds = await listHolds()
  return tallyMoneyNotSpent(holds)
}

/** Mark active holds past endsAt as ended — does NOT award money-not-spent */
export async function syncExpiredHolds(now = Date.now()): Promise<number> {
  const holds = await listHolds()
  let n = 0
  for (const h of holds) {
    if (h.status === 'active' && h.endsAt <= now) {
      await putHold({
        ...h,
        status: 'ended',
        updatedAt: now,
      })
      n += 1
    }
  }
  return n
}
