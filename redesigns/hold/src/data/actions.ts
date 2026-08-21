import { addDays } from '../lib/format'
import { createId } from '../lib/id'
import {
  decisionEmailBody,
  holdStartedEmailBody,
  sendUserEmail,
} from '../lib/email'
import { formatMoney } from '../lib/currency'
import { scoreAssessment } from '../scoring/engine'
import type { AssessmentInput, Recommendation } from '../scoring/types'
import * as auth from './auth'
import * as db from './db'
import type {
  AssessmentRecord,
  FinalDecision,
  HoldRecord,
  ProductRecord,
} from './types'

export async function createProductAndAssessment(args: {
  name: string
  category: AssessmentInput['category']
  price: number
  currency: string
  url?: string
  input: AssessmentInput
}): Promise<{ product: ProductRecord; assessment: AssessmentRecord }> {
  const now = Date.now()
  const product: ProductRecord = {
    id: createId('prod'),
    name: args.name.trim(),
    category: args.category,
    price: args.price,
    currency: args.currency,
    url: args.url?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  const result = scoreAssessment(args.input)
  const assessment: AssessmentRecord = {
    id: createId('assess'),
    productId: product.id,
    input: args.input,
    result,
    createdAt: now,
  }
  // Persist product + assessment locally even anonymously (browser-only).
  // Auth is required only when creating a HOLD.
  await db.putProduct(product)
  await db.putAssessment(assessment)
  return { product, assessment }
}

export async function reassessProduct(args: {
  productId: string
  input: AssessmentInput
  price?: number
  currency?: string
  name?: string
}): Promise<AssessmentRecord> {
  const product = await db.getProduct(args.productId)
  if (!product) throw new Error('Product not found')
  const now = Date.now()
  const updated: ProductRecord = {
    ...product,
    name: args.name?.trim() || product.name,
    price: args.price ?? product.price,
    currency: args.currency ?? product.currency,
    updatedAt: now,
  }
  const result = scoreAssessment(args.input)
  const assessment: AssessmentRecord = {
    id: createId('assess'),
    productId: product.id,
    input: args.input,
    result,
    createdAt: now,
  }
  await db.putProduct(updated)
  await db.putAssessment(assessment)
  return assessment
}

/**
 * Persist a HOLD — requires auth. Creates session gate at call site.
 */
export async function createHold(args: {
  productId: string
  assessmentId: string
  holdDays: number
  recommendation: Recommendation
}): Promise<HoldRecord> {
  const user = await auth.getCurrentUser()
  if (!user) {
    throw new Error('AUTH_REQUIRED')
  }
  const now = Date.now()
  const days = Math.max(1, args.holdDays)
  const endsAt =
    days === 1 ? now + 24 * 60 * 60 * 1000 : addDays(now, days)

  const hold: HoldRecord = {
    id: createId('hold'),
    productId: args.productId,
    assessmentId: args.assessmentId,
    recommendation: args.recommendation,
    holdDays: days,
    startedAt: now,
    endsAt,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  await db.syncExpiredHolds(now)
  await db.putHold(hold)
  const product = await db.getProduct(args.productId)
  if (product) {
    await db.putProduct({ ...product, updatedAt: now })
    void sendUserEmail({
      to: user.email,
      subject: `HOLD started — ${product.name}`,
      message: holdStartedEmailBody({
        name: user.displayName,
        product: product.name,
        priceLabel: formatMoney(product.price, product.currency),
        endsAt: hold.endsAt,
        days: hold.holdDays,
      }),
    })
  }
  return hold
}

export async function holdAgain(args: {
  previousHoldId: string
  holdDays: number
}): Promise<HoldRecord> {
  const prev = await db.getHold(args.previousHoldId)
  if (!prev) throw new Error('Hold not found')
  const user = await auth.getCurrentUser()
  if (!user) throw new Error('AUTH_REQUIRED')

  const now = Date.now()
  // Close previous without money-not-spent
  await db.putHold({
    ...prev,
    status: 'decided',
    decision: 'hold_again',
    decidedAt: now,
    updatedAt: now,
  })

  const hold: HoldRecord = {
    id: createId('hold'),
    productId: prev.productId,
    assessmentId: prev.assessmentId, // retain original assessment & scores
    recommendation: prev.recommendation,
    holdDays: args.holdDays,
    startedAt: now,
    endsAt:
      args.holdDays === 1
        ? now + 24 * 60 * 60 * 1000
        : addDays(now, args.holdDays),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  await db.putHold(hold)
  return hold
}

export async function decideHold(args: {
  holdId: string
  decision: Extract<FinalDecision, 'bought' | 'let_it_go'>
}): Promise<HoldRecord> {
  const hold = await db.getHold(args.holdId)
  if (!hold) throw new Error('Hold not found')
  const product = await db.getProduct(hold.productId)
  const now = Date.now()

  const updated: HoldRecord = {
    ...hold,
    status: 'decided',
    decision: args.decision,
    decidedAt: now,
    updatedAt: now,
  }

  // MONEY NOT SPENT only on explicit LET IT GO
  if (args.decision === 'let_it_go' && product) {
    updated.moneyNotSpent = product.price
    updated.moneyCurrency = product.currency
  }

  await db.putHold(updated)

  const user = await auth.getCurrentUser()
  if (user && product) {
    void sendUserEmail({
      to: user.email,
      subject: `HOLD decision — ${product.name}`,
      message: decisionEmailBody({
        name: user.displayName,
        product: product.name,
        decision: args.decision === 'let_it_go' ? 'Let it go' : 'Bought',
        moneyNote:
          args.decision === 'let_it_go'
            ? `Money not spent: ${formatMoney(product.price, product.currency)}`
            : undefined,
      }),
    })
  }

  return updated
}

export async function getDashboard() {
  await db.syncExpiredHolds()
  const [products, holds, money, user] = await Promise.all([
    db.listProducts(),
    db.listHolds(),
    db.sumMoneyNotSpent(),
    auth.getCurrentUser(),
  ])
  return { products, holds, money, user }
}
