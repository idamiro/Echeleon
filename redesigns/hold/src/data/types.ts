import type {
  Affordability,
  AssessmentInput,
  Category,
  Confidence,
  Considered,
  Frequency,
  ImpulseRisk,
  Overlap,
  Reason,
  Recommendation,
  ScoringResult,
} from '../scoring/types'

export type HoldStatus = 'active' | 'ended' | 'decided'

export type FinalDecision = 'bought' | 'let_it_go' | 'hold_again'

export interface UserProfile {
  id: string
  displayName: string
  email: string
  createdAt: number
}

export interface ProductRecord {
  id: string
  name: string
  category: Category
  price: number
  currency: string
  url?: string
  createdAt: number
  updatedAt: number
}

export interface AssessmentRecord {
  id: string
  productId: string
  input: AssessmentInput
  result: ScoringResult
  createdAt: number
}

export interface HoldRecord {
  id: string
  productId: string
  assessmentId: string
  /** Snapshot of recommendation at hold creation */
  recommendation: Recommendation
  holdDays: number
  startedAt: number
  endsAt: number
  status: HoldStatus
  /** Explicit user actions only — expired ignores do not count for money */
  decision?: FinalDecision
  decidedAt?: number
  /** Only set when decision === 'let_it_go' */
  moneyNotSpent?: number
  moneyCurrency?: string
  createdAt: number
  updatedAt: number
}

export interface DraftAssessment {
  productName: string
  category: Category
  price: string
  currency: string
  url: string
  frequency: Frequency | ''
  overlap: Overlap | ''
  reason: Reason | ''
  considered: Considered | ''
  affordability: Affordability | ''
  ownershipYears: string
  importance: number
}

export type {
  Affordability,
  AssessmentInput,
  Category,
  Confidence,
  Considered,
  Frequency,
  ImpulseRisk,
  Overlap,
  Reason,
  Recommendation,
  ScoringResult,
}
