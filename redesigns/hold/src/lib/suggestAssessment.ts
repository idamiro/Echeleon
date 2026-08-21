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
  hints: Record<string, string>
  blurb: string
}

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
    case 'footwear':
      return {
        ...base,
        frequency: 'few_times_week',
        ownershipYears: '1.5',
        reason: 'just_like',
        hints: {
          frequency: 'Be honest about rotation — many pairs die in the closet.',
          overlap: 'Do you already own a pair for the same weather / use?',
        },
        blurb: 'Footwear lean: wear frequency and overlap beat the unboxing urge.',
      }
    case 'clothing':
      return {
        ...base,
        frequency: 'few_times_week',
        ownershipYears: '1.5',
        reason: text.includes('sale') ? 'on_sale' : 'just_like',
        hints: {
          frequency: 'Cost-per-wear only works if it actually leaves the hanger.',
        },
        blurb: 'Clothing lean: real wears and closet overlap matter most.',
      }
    case 'audio':
      return {
        ...base,
        frequency: 'daily',
        ownershipYears: '3',
        reason: 'improve_regular',
        importance: 4,
        hints: {
          overlap: 'Working headphones already owned is a classic pause signal.',
        },
        blurb: 'Audio lean: daily listening vs “nice upgrade” is the whole game.',
      }
    case 'tech':
      return {
        ...base,
        frequency: /phone|laptop|watch|keyboard|mouse/.test(text)
          ? 'daily'
          : 'few_times_week',
        ownershipYears: '3',
        reason: 'improve_regular',
        considered: 'few_weeks',
        importance: 4,
        hints: {
          overlap: 'A working device that already does the job should slow you down.',
        },
        blurb: 'Tech lean: ownership overlap and daily use beat launch hype.',
      }
    case 'kitchen':
      return {
        ...base,
        frequency: 'few_times_week',
        ownershipYears: '5',
        reason: 'improve_regular',
        considered: 'few_weeks',
        importance: 3,
        blurb: 'Kitchen lean: counter space and cook frequency tell the truth.',
      }
    case 'home':
      return {
        ...base,
        frequency: 'weekly',
        ownershipYears: '5',
        reason: 'genuine_need',
        considered: 'few_weeks',
        importance: 4,
        blurb: 'Home lean: longevity and replacement need usually win.',
      }
    case 'beauty':
      return {
        ...base,
        frequency: 'daily',
        ownershipYears: '0.5',
        reason: 'just_like',
        importance: 2,
        hints: {
          ownershipYears: 'Many beauty products empty in months — plan accordingly.',
        },
        blurb: 'Beauty lean: routine fit and unfinished bottles already at home.',
      }
    case 'sports':
      return {
        ...base,
        frequency: 'few_times_week',
        ownershipYears: '3',
        reason: 'wanted_awhile',
        considered: 'few_weeks',
        blurb: 'Sports lean: session count beats aspirational gear.',
      }
    case 'travel':
      return {
        ...base,
        frequency: 'few_times_month',
        ownershipYears: '4',
        reason: 'genuine_need',
        considered: 'few_weeks',
        blurb: 'Travel lean: trip frequency vs one-off packing fantasy.',
      }
    case 'hobby':
      return {
        ...base,
        frequency: 'few_times_month',
        ownershipYears: '3',
        reason: 'wanted_awhile',
        considered: 'few_weeks',
        blurb: 'Hobby lean: sparse use is normal — watch impulse and budget.',
      }
    case 'digital':
      return {
        ...base,
        frequency: 'few_times_week',
        ownershipYears: '1',
        reason: 'improve_regular',
        affordability: 'noticeably',
        hints: {
          ownershipYears: 'Think in years you would keep renewing.',
          frequency: 'Subscriptions die when you stop opening them.',
        },
        blurb: 'Digital lean: renewals and open-rate matter more than features.',
      }
    default:
      return base
  }
}
