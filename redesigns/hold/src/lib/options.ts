import type {
  Affordability,
  Category,
  Considered,
  Frequency,
  Overlap,
  Reason,
} from '../scoring/types'

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'clothing', label: 'Clothing' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'tech', label: 'Tech' },
  { value: 'audio', label: 'Audio' },
  { value: 'home', label: 'Home' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'beauty', label: 'Beauty & care' },
  { value: 'hobby', label: 'Hobby' },
  { value: 'sports', label: 'Sports & fitness' },
  { value: 'travel', label: 'Travel' },
  { value: 'digital', label: 'Digital / subscription' },
  { value: 'other', label: 'Other' },
]

export const HOLD_DAY_OPTIONS = [
  { value: 1, label: '24 hours' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
] as const

export interface QuestionOption<T extends string> {
  value: T
  label: string
}

export interface ProductQuestionSet {
  frequency: { legend: string; options: QuestionOption<Frequency>[] }
  overlap: { legend: string; options: QuestionOption<Overlap>[] }
  reason: { legend: string; options: QuestionOption<Reason>[] }
  considered: { legend: string; options: QuestionOption<Considered>[] }
  affordability: { legend: string; options: QuestionOption<Affordability>[] }
  ownership: { legend: string; hint?: string }
  importance: { legend: string; hint?: string }
}

function shortName(name: string): string {
  const n = name.trim()
  if (n.length <= 42) return n || 'this'
  return `${n.slice(0, 39)}…`
}

/** Product-aware question copy — same scoring keys, better prompts */
export function buildQuestionsForProduct(args: {
  category: Category
  name: string
}): ProductQuestionSet {
  const item = shortName(args.name)
  const c = args.category

  const frequency = ((): ProductQuestionSet['frequency'] => {
    switch (c) {
      case 'footwear':
        return {
          legend: `How often would you wear ${item}?`,
          options: [
            { value: 'daily', label: 'Most days — daily rotation' },
            { value: 'few_times_week', label: 'A few times a week' },
            { value: 'weekly', label: 'About once a week' },
            { value: 'few_times_month', label: 'A few times a month' },
            { value: 'rarely', label: 'Special occasions only' },
          ],
        }
      case 'clothing':
        return {
          legend: `How often would ${item} actually leave the closet?`,
          options: [
            { value: 'daily', label: 'Weekly uniform — many wears' },
            { value: 'few_times_week', label: 'A few wears a week' },
            { value: 'weekly', label: 'About once a week' },
            { value: 'few_times_month', label: 'A few times a month' },
            { value: 'rarely', label: 'Rarely — more “nice to have”' },
          ],
        }
      case 'audio':
      case 'tech':
        return {
          legend: `How often would you use ${item}?`,
          options: [
            { value: 'daily', label: 'Daily driver' },
            { value: 'few_times_week', label: 'Several times a week' },
            { value: 'weekly', label: 'About once a week' },
            { value: 'few_times_month', label: 'A few times a month' },
            { value: 'rarely', label: 'Rarely / niche use' },
          ],
        }
      case 'kitchen':
        return {
          legend: `How often would ${item} earn counter / cupboard space?`,
          options: [
            { value: 'daily', label: 'Daily cooking' },
            { value: 'few_times_week', label: 'A few cooks a week' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'few_times_month', label: 'A few times a month' },
            { value: 'rarely', label: 'Rare special recipes' },
          ],
        }
      case 'sports':
        return {
          legend: `How often would you train / play with ${item}?`,
          options: [
            { value: 'daily', label: 'Nearly every day' },
            { value: 'few_times_week', label: 'A few sessions a week' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'few_times_month', label: 'A few times a month' },
            { value: 'rarely', label: 'Seasonal / rare' },
          ],
        }
      case 'travel':
        return {
          legend: `How often would ${item} come on trips?`,
          options: [
            { value: 'daily', label: 'Living out of a bag right now' },
            { value: 'few_times_week', label: 'Frequent short trips' },
            { value: 'weekly', label: 'Regular travel weeks' },
            { value: 'few_times_month', label: 'A few trips a month / season' },
            { value: 'rarely', label: 'One trip, then storage' },
          ],
        }
      case 'digital':
        return {
          legend: `How often would you open / use ${item}?`,
          options: [
            { value: 'daily', label: 'Daily habit' },
            { value: 'few_times_week', label: 'A few times a week' },
            { value: 'weekly', label: 'Weekly check-in' },
            { value: 'few_times_month', label: 'A few times a month' },
            { value: 'rarely', label: 'I would mostly forget it' },
          ],
        }
      case 'beauty':
        return {
          legend: `How often would you use ${item} in your routine?`,
          options: [
            { value: 'daily', label: 'Daily routine' },
            { value: 'few_times_week', label: 'A few times a week' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'few_times_month', label: 'Occasional' },
            { value: 'rarely', label: 'Rarely' },
          ],
        }
      default:
        return {
          legend: `How often would you use ${item}?`,
          options: [
            { value: 'daily', label: 'Daily' },
            { value: 'few_times_week', label: 'A few times a week' },
            { value: 'weekly', label: 'About once a week' },
            { value: 'few_times_month', label: 'A few times a month' },
            { value: 'rarely', label: 'Rarely' },
          ],
        }
    }
  })()

  const overlap = ((): ProductQuestionSet['overlap'] => {
    const noun =
      c === 'footwear'
        ? 'pair that covers the same use'
        : c === 'audio'
          ? 'headphones / speakers that do this job'
          : c === 'digital'
            ? 'app or subscription that overlaps'
            : c === 'kitchen'
              ? 'tool that already does this'
              : 'thing that does the same job'
    return {
      legend: `Do you already own a ${noun}?`,
      options: [
        { value: 'no', label: 'No — nothing covers this' },
        { value: 'needs_replacing', label: 'Yes — but it needs replacing' },
        { value: 'works_fine', label: 'Yes — and it still works fine' },
      ],
    }
  })()

  const reason: ProductQuestionSet['reason'] = {
    legend: `Why ${item} — honestly?`,
    options: [
      { value: 'genuine_need', label: 'Something broke / I truly need this' },
      { value: 'improve_regular', label: 'It would upgrade something I already do' },
      { value: 'wanted_awhile', label: "I've wanted this for a while" },
      { value: 'on_sale', label: 'The price / sale is pulling me' },
      { value: 'just_discovered', label: 'I just discovered it' },
      { value: 'just_like', label: 'I just like it' },
    ],
  }

  const considered: ProductQuestionSet['considered'] = {
    legend: `How long have you been sitting with ${item}?`,
    options: [
      { value: 'today', label: 'Started today' },
      { value: 'few_days', label: 'A few days' },
      { value: 'few_weeks', label: 'A few weeks' },
      { value: 'more_month', label: 'More than a month' },
    ],
  }

  const affordability: ProductQuestionSet['affordability'] = {
    legend: `If you buy ${item} at this price, how hard does it hit available money?`,
    options: [
      { value: 'barely', label: 'Barely — I would hardly notice' },
      { value: 'noticeably', label: 'Noticeably — I would feel it' },
      { value: 'significantly', label: 'Significantly — it would strain things' },
    ],
  }

  const ownershipYearsHint =
    c === 'clothing' || c === 'footwear' || c === 'beauty'
      ? 'Fashion and consumables often age out faster — be honest.'
      : c === 'home' || c === 'kitchen'
        ? 'Home pieces can last many years if you keep them.'
        : c === 'digital'
          ? 'For subscriptions, think in years you would keep paying.'
          : 'How long until you would replace or abandon this?'

  return {
    frequency,
    overlap,
    reason,
    considered,
    affordability,
    ownership: {
      legend:
        c === 'digital'
          ? 'How many years would you keep paying / using this?'
          : `How many years do you expect to keep using ${item}?`,
      hint: ownershipYearsHint,
    },
    importance: {
      legend: `If you could not get ${item}, how much would it matter (1–5)?`,
      hint: '5 = real friction in life/work. 1 = mild disappointment.',
    },
  }
}

/** @deprecated use buildQuestionsForProduct — kept for simple lists */
export const FREQUENCY_OPTIONS = buildQuestionsForProduct({
  category: 'other',
  name: 'this',
}).frequency.options
export const OVERLAP_OPTIONS = buildQuestionsForProduct({
  category: 'other',
  name: 'this',
}).overlap.options
export const REASON_OPTIONS = buildQuestionsForProduct({
  category: 'other',
  name: 'this',
}).reason.options
export const CONSIDERED_OPTIONS = buildQuestionsForProduct({
  category: 'other',
  name: 'this',
}).considered.options
export const AFFORDABILITY_OPTIONS = buildQuestionsForProduct({
  category: 'other',
  name: 'this',
}).affordability.options
