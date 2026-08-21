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
  { value: 'tech', label: 'Tech' },
  { value: 'home', label: 'Home' },
  { value: 'hobby', label: 'Hobby' },
  { value: 'other', label: 'Other' },
]

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'few_times_week', label: 'A few times a week' },
  { value: 'weekly', label: 'About once a week' },
  { value: 'few_times_month', label: 'A few times a month' },
  { value: 'rarely', label: 'Rarely' },
]

export const OVERLAP_OPTIONS: { value: Overlap; label: string }[] = [
  { value: 'no', label: 'No — nothing covers this' },
  { value: 'needs_replacing', label: 'Yes — but it needs replacing' },
  { value: 'works_fine', label: 'Yes — and it still works fine' },
]

export const REASON_OPTIONS: { value: Reason; label: string }[] = [
  { value: 'genuine_need', label: 'Genuine need' },
  { value: 'improve_regular', label: 'Improve something I already do' },
  { value: 'wanted_awhile', label: "I've wanted this for a while" },
  { value: 'on_sale', label: "It's on sale" },
  { value: 'just_discovered', label: 'I just discovered it' },
  { value: 'just_like', label: 'I just like it' },
]

export const CONSIDERED_OPTIONS: { value: Considered; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'few_days', label: 'A few days' },
  { value: 'few_weeks', label: 'A few weeks' },
  { value: 'more_month', label: 'More than a month' },
]

export const AFFORDABILITY_OPTIONS: {
  value: Affordability
  label: string
}[] = [
  { value: 'barely', label: 'Barely — I would hardly notice' },
  { value: 'noticeably', label: 'Noticeably — I would feel it' },
  { value: 'significantly', label: 'Significantly — it would strain things' },
]

export const HOLD_DAY_OPTIONS = [
  { value: 1, label: '24 hours' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
] as const
