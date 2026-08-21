import type {
  Affordability,
  Category,
  Considered,
  Frequency,
  Overlap,
  Reason,
} from '../scoring/types'

export interface AssessmentSuggestion {
  frequency: Frequency
  overlap: Overlap
  reason: Reason
  considered: Considered
  affordability: Affordability
  ownershipYears: string
  importance: number
  hints: Partial<
    Record<
      | 'frequency'
      | 'overlap'
      | 'reason'
      | 'considered'
      | 'affordability'
      | 'ownershipYears'
      | 'importance',
      string
    >
  >
  blurb: string
}

/**
 * Soft defaults / hints by product category — never invents buy advice,
 * only pre-fills common patterns the user can override.
 */
export function suggestAssessmentForProduct(args: {
  category: Category
  name: string
}): AssessmentSuggestion {
  const text = `${args.name} ${args.category}`.toLowerCase()

  const base: AssessmentSuggestion = {
    frequency: 'few_times_week',
    overlap: 'no',
    reason: 'improve_regular',
    considered: 'few_days',
    affordability: 'noticeably',
    ownershipYears: '2',
    importance: 3,
    hints: {},
    blurb: 'Suggestions based on this product type — change anything that feels wrong.',
  }

  switch (args.category) {
    case 'clothing':
      return {
        ...base,
        frequency: 'few_times_week',
        ownershipYears: '1.5',
        reason: text.includes('sale') ? 'on_sale' : 'just_like',
        considered: 'few_days',
        importance: 3,
        hints: {
          frequency: 'Clothes often land at a few wears a week — adjust if this is daily uniform.',
          ownershipYears: 'Fashion cycles are shorter; 1–2 years is a common planning horizon.',
          reason: 'Style pulls are easy to overstate as need.',
        },
        blurb: 'Clothing lean: focus on real wear frequency and whether something already covers it.',
      }
    case 'tech':
      return {
        ...base,
        frequency: /phone|laptop|headphone|earbud|keyboard|mouse|watch/.test(text)
          ? 'daily'
          : 'few_times_week',
        ownershipYears: '3',
        reason: 'improve_regular',
        considered: 'few_weeks',
        importance: 4,
        hints: {
          frequency: 'Daily-driver tech should show up as daily or a few times a week.',
          overlap: 'Working phone/laptop/headphones already owned is a common pause signal.',
          ownershipYears: 'Tech often lasts 2–4 years before you want an upgrade.',
        },
        blurb: 'Tech lean: ownership overlap and daily use matter more than the launch story.',
      }
    case 'home':
      return {
        ...base,
        frequency: 'weekly',
        ownershipYears: '5',
        reason: 'genuine_need',
        considered: 'few_weeks',
        importance: 4,
        hints: {
          ownershipYears: 'Home goods are long-lived — stretch the ownership span if it will stay.',
          frequency: 'Household items can score lower on “daily” and still be high need.',
        },
        blurb: 'Home lean: longevity and replacement need usually outweigh impulse timing.',
      }
    case 'hobby':
      return {
        ...base,
        frequency: 'few_times_month',
        ownershipYears: '3',
        reason: 'wanted_awhile',
        considered: 'few_weeks',
        importance: 3,
        hints: {
          frequency: 'Hobbies are often sparse but meaningful — be honest about session count.',
          reason: '“Wanted awhile” is healthier than “just discovered” for gear.',
        },
        blurb: 'Hobby lean: sparse use is normal — watch impulse and budget impact.',
      }
    default:
      return {
        ...base,
        hints: {
          frequency: 'Start from how often you would actually reach for this.',
        },
        blurb: 'General lean: answer from behavior, not the store page story.',
      }
  }
}
