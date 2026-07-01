import {
  findBrand,
  normalizeQueryText,
  stripFillerWords,
  CAR_NOISE_WORDS,
  buildWordRegex,
} from './lexicon'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Combine recent user turns so follow-up messages inherit brand/size context. */
export const combineUserContext = (
  history: ConversationMessage[],
  currentText: string,
  maxTurns = 3,
): string => {
  const recentUser = history
    .filter((m) => m.role === 'user')
    .slice(-maxTurns)
    .map((m) => m.content)

  return [...recentUser, currentText].join(' ')
}

/**
 * Tries to detect a tyre size in the message (with or without "R")
 * and returns the canonical "WWW/HH RDD" form, or null if not found.
 */
export const normalizeTyreSize = (text: string): string | null => {
  const canonical = text.match(/\b(\d{3})\/(\d{2})\s*[Rr](\d{2})\b/)
  if (canonical) return `${canonical[1]}/${canonical[2]} R${canonical[3]}`

  const noR = text.match(/\b(\d{3})[\/\-](\d{2})\s*[\/\-\s](\d{2})\b/)
  if (noR) return `${noR[1]}/${noR[2]} R${noR[3]}`

  const spaceSep = text.match(
    /\b(1[4-9]\d|2\d{2})\s+(3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9])\s+(1[3-9]|2[0-2])\b/,
  )
  if (spaceSep) return `${spaceSep[1]}/${spaceSep[2]} R${spaceSep[3]}`

  return null
}

export interface ExtractProductQueryOptions {
  learnedFillers?: readonly string[]
}

/**
 * Extracts the most likely product identifier from free-text (optionally
 * multi-turn). Returns a string suitable for Sheets substring lookup.
 */
export const extractProductQuery = (
  text: string,
  options: ExtractProductQueryOptions = {},
): string => {
  const prepared = normalizeQueryText(text)
  const { learnedFillers = [] } = options

  const normalizedSize = normalizeTyreSize(prepared)

  const skuMatch = prepared.match(/\bTYR-[A-Z]+-\d+\b/i)
  if (skuMatch) return skuMatch[0]

  const brand = findBrand(prepared)

  if (brand && normalizedSize) return `${brand} ${normalizedSize}`
  if (normalizedSize) return normalizedSize
  if (brand) return brand

  return stripFillerWords(prepared, learnedFillers)
}

/** True when lookup likely failed due to missing tyre brand/size (e.g. car-model-only query). */
export const needsSizeOrBrandPrompt = (text: string, extractedQuery: string): boolean => {
  const prepared = normalizeQueryText(text)
  const hasVehicle = buildWordRegex([...CAR_NOISE_WORDS]).test(prepared)
  const hasBrandOrSize = findBrand(prepared) !== null || normalizeTyreSize(prepared) !== null
  const hasTyreIntent = /\btyre[s]?\b/i.test(prepared)
  const extractTooShort = extractedQuery.trim().length < 3

  if (hasBrandOrSize) return false
  if (hasVehicle && hasTyreIntent) return true
  if (hasTyreIntent && extractTooShort) return true
  return hasVehicle && extractTooShort
}
