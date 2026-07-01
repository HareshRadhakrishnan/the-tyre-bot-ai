/**
 * Shared multilingual lexicon for guardrails, query extraction, and language detection.
 * Single source of truth — avoid duplicating brand/keyword lists across modules.
 */

export const BRANDS = [
  'mrf',
  'apollo',
  'bridgestone',
  'ceat',
  'goodyear',
  'falken',
  'yokohama',
  'michelin',
  'jk',
  'tvs',
  'dunlop',
  'pirelli',
  'continental',
  'hankook',
  'nankang',
  'firestone',
  'nexen',
  'kumho',
  'maxxis',
  'bfgoodrich',
] as const

export const DOMAIN_KEYWORDS_EN = [
  'tyre',
  'tyres',
  'tire',
  'tires',
  'wheel',
  'wheels',
  'rim',
  'rims',
  'stock',
  'available',
  'availability',
  'price',
  'cost',
  'rate',
  'product',
  'item',
  'sku',
  'quantity',
  'qty',
  'size',
  'kitna',
  'dam',
  'qeemat',
] as const

export const DOMAIN_KEYWORDS_SINGLISH = [
  'ganna',
  'gannawa',
  'gatta',
  'ona',
  'oni',
  'thiyenawada',
  'tiyenawada',
  'naddha',
  'nadda',
  'mila',
  'gana',
  'ganan',
  'keeyada',
  'kiyada',
  'kiyanna',
  'balanna',
] as const

export const DOMAIN_KEYWORDS_TANGLISH = [
  'venum',
  'enakku',
  'ennakku',
  'ennaku',
  'iruka',
  'iruku',
  'irukka',
  'evlo',
  'evvalavu',
  'evlavu',
  'vilai',
  'vilay',
  'vaanga',
  'vanga',
  'kaasu',
  'onnuku',
  'onnu',
] as const

/** Vehicle / car-model words stripped from Sheets queries — not tyre brands. */
export const CAR_NOISE_WORDS = [
  'car',
  'cars',
  'vehicle',
  'vehicles',
  'auto',
  'suv',
  'sedan',
  'lamborghini',
  'laborgini',
  'lamborgini',
  'urus',
  'aventador',
  'huracan',
  'toyota',
  'honda',
  'bmw',
  'mercedes',
  'benz',
  'audi',
  'nissan',
  'hyundai',
  'kia',
  'ford',
  'jeep',
  'volkswagen',
  'vw',
  'porsche',
  'ferrari',
  'bentley',
  'rolls',
  'royce',
  'mazda',
  'subaru',
  'lexus',
  'volvo',
  'landrover',
  'range',
  'rover',
  'tesla',
  'maruti',
  'suzuki',
  'tata',
  'mahindra',
  'mg',
  'byd',
] as const

export const FILLER_WORDS = [
  // English filler
  'do you have',
  'is',
  'are',
  'any',
  'please',
  'hi',
  'hello',
  'the',
  'a',
  'an',
  'for',
  'of',
  'in',
  'stock',
  'available',
  'check',
  'want',
  'need',
  'looking',
  'get',
  'give',
  'me',
  'i',
  'you',
  'have',
  'sell',
  'what',
  'how',
  'much',
  'many',
  // Romanized Sinhala / Tamil filler
  'eka',
  'ekak',
  'ona',
  'oni',
  'nadda',
  'naddha',
  'ganna',
  'gannawa',
  'enna',
  'epdi',
  'iruku',
  'iruka',
  'kiyanna',
  'machan',
  'machaan',
  'da',
  'mata',
  'mage',
  'ekata',
  'naa',
  'bro',
  'venum',
  'vaanga',
  'vanga',
  // Tamil filler
  'enakku',
  'ennakku',
  'ennaku',
  'onnuku',
  'onnu',
  'ku',
  'car',
  'cars',
  'vehicle',
] as const

export const CONVERSATIONAL_KEYWORDS = [
  // English
  'hi',
  'hello',
  'hey',
  'yo',
  'hiya',
  'howdy',
  'thanks',
  'thank you',
  'thankyou',
  'ty',
  'cheers',
  'thx',
  'ok',
  'okay',
  'okey',
  'sure',
  'alright',
  'fine',
  'yes',
  'yeah',
  'yep',
  'yup',
  'no',
  'nope',
  'nah',
  'bye',
  'goodbye',
  'later',
  'bro',
  // Romanized Sinhala
  'ayubowan',
  'kohomada',
  'hari',
  'hondai',
  'stuti',
  'istuti',
  'bohoma',
  'aney',
  'machan',
  // Romanized Tamil
  'vanakkam',
  'nandri',
  'nandrig',
  'seri',
  'epdi',
  'enna',
  'machaan',
  'da',
] as const

/** Escape special regex characters in a literal string. */
const escapeRegex = (word: string): string =>
  word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Builds a case-insensitive word-boundary regex from a list of words/phrases.
 * Longer phrases are sorted first so multi-word matches take priority.
 */
export const buildWordRegex = (words: readonly string[]): RegExp => {
  const sorted = [...words].sort((a, b) => b.length - a.length)
  const pattern = sorted.map(escapeRegex).join('|')
  return new RegExp(`\\b(${pattern})\\b`, 'gi')
}

/** Find the first brand mentioned in text (case-insensitive). */
export const findBrand = (text: string): string | null => {
  const lower = text.toLowerCase()
  for (const brand of BRANDS) {
    if (brand === 'jk') {
      if (/\bjk\s?tyre\b/i.test(text) || /\bjk\b/i.test(text)) return brand
      continue
    }
    if (new RegExp(`\\b${escapeRegex(brand)}\\b`, 'i').test(lower)) return brand
  }
  return null
}

/** Normalise common tyre typos before guardrail / extraction. */
export const normalizeQueryText = (text: string): string =>
  text.replace(/\btye\b/gi, 'tyre').replace(/\btyer\b/gi, 'tyre')

/** Strip filler + vehicle noise words; optionally merge DB-learned fillers. */
export const stripFillerWords = (
  text: string,
  extraFillers: readonly string[] = [],
): string => {
  const allFillers = [...FILLER_WORDS, ...CAR_NOISE_WORDS, ...extraFillers]
  return text
    .replace(buildWordRegex(allFillers), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const SINHALA_SCRIPT = /[\u0D80-\u0DFF]/
const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/

const ROMANIZED_SINGLISH_REGEX = buildWordRegex([
  ...DOMAIN_KEYWORDS_SINGLISH,
  'ayubowan',
  'kohomada',
  'hari',
  'hondai',
  'machan',
  'mata',
  'mage',
])

const ROMANIZED_TANGLISH_REGEX = buildWordRegex([
  ...DOMAIN_KEYWORDS_TANGLISH,
  'vanakkam',
  'nandri',
  'seri',
  'epdi',
  'enna',
  'machaan',
  'enakku',
  'onnuku',
])

export type LanguageHint =
  | 'Reply in Sinhala script, matching the customer\'s wording.'
  | 'Reply in Tamil script, matching the customer\'s wording.'
  | 'Reply in romanized Singlish, matching the customer\'s wording and mix.'
  | 'Reply in romanized Tanglish, matching the customer\'s wording and mix.'
  | 'Reply in English.'

/**
 * Detects the customer's language/script for a dynamic LLM reply hint.
 * Checks native script first, then romanized Singlish/Tanglish markers.
 */
export const detectLanguageHint = (text: string): LanguageHint => {
  if (SINHALA_SCRIPT.test(text)) {
    return 'Reply in Sinhala script, matching the customer\'s wording.'
  }
  if (TAMIL_SCRIPT.test(text)) {
    return 'Reply in Tamil script, matching the customer\'s wording.'
  }

  const hasSinglish = ROMANIZED_SINGLISH_REGEX.test(text)
  const hasTanglish = ROMANIZED_TANGLISH_REGEX.test(text)

  if (hasSinglish && hasTanglish) {
    return 'Reply in romanized Singlish, matching the customer\'s wording and mix.'
  }
  if (hasSinglish) {
    return 'Reply in romanized Singlish, matching the customer\'s wording and mix.'
  }
  if (hasTanglish) {
    return 'Reply in romanized Tanglish, matching the customer\'s wording and mix.'
  }

  return 'Reply in English.'
}
