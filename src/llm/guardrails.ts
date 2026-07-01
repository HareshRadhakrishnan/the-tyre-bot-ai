import {
  BRANDS,
  DOMAIN_KEYWORDS_EN,
  DOMAIN_KEYWORDS_SINGLISH,
  DOMAIN_KEYWORDS_TANGLISH,
  CONVERSATIONAL_KEYWORDS,
  buildWordRegex,
  normalizeQueryText,
} from './lexicon'

const SINHALA_SCRIPT = /[\u0D80-\u0DFF]/
const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/

/**
 * Input guardrail — returns true when the message is likely about
 * tyres, products, stock, or prices. If false, skip Sheets + LLM entirely.
 */
const IN_DOMAIN_PATTERNS = [
  // Tyre size notation
  /\bR\d{2}\b/,
  /\b\d{3}\/\d{2}\b/,
  /\b\d{3}[\/\-]\d{2}[\/\-\s]\d{2}\b/,
  /\b(1[4-9]\d|2\d{2})\s+\d{2}\s+(1[3-9]|2[0-2])\b/,
  // English domain keywords
  buildWordRegex(DOMAIN_KEYWORDS_EN),
  // Singlish / Tanglish domain keywords
  buildWordRegex(DOMAIN_KEYWORDS_SINGLISH),
  buildWordRegex(DOMAIN_KEYWORDS_TANGLISH),
  // Brands
  buildWordRegex(BRANDS),
  /\bjk\s?tyre\b/i,
  // English phrase patterns
  /\bhow much\b/i,
  /\bdo you (have|sell|stock)\b/i,
  /\bis .+ available\b/i,
  /\bcheck stock\b/i,
  /\bcheck price\b/i,
  /\bwhat.?s the price\b/i,
  /\bwhat is the price\b/i,
  /\bhow many\b/i,
  /\bin.?stock\b/i,
  /\bout.?of.?stock\b/i,
  /\bavailab/i,
]

export const isInDomain = (text: string): boolean => {
  if (SINHALA_SCRIPT.test(text) || TAMIL_SCRIPT.test(text)) return true
  const normalized = normalizeQueryText(text)
  return IN_DOMAIN_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * Conversational allow-list — greetings, pleasantries, and short
 * acknowledgements in English, romanized Sinhala, and romanized Tamil.
 * Messages that match are allowed through to the LLM even on first contact.
 */
const CONVERSATIONAL_PATTERNS = [
  /^\s*(hi|hello|hey|yo|hiya|howdy)\b/i,
  /\bgood\s+(morning|afternoon|evening|day|night)\b/i,
  /\b(thanks|thank\s*you|thankyou|ty|cheers|thx)\b/i,
  /\b(ok|okay|okey|sure|alright|fine|got\s*it|noted)\b/i,
  /\b(yes|yeah|yep|yup|no|nope|nah)\b/i,
  /\b(bye|goodbye|see\s*you|later|tc|take\s*care)\b/i,
  /\bhow\s+are\s+you\b/i,
  /\bwhat.?s\s+up\b/i,
  buildWordRegex(CONVERSATIONAL_KEYWORDS),
]

export const isConversational = (text: string): boolean =>
  CONVERSATIONAL_PATTERNS.some((p) => p.test(text))

/**
 * Output guardrail — returns false when the LLM reply appears to have
 * drifted off-topic. Replace with a safe fallback message if false.
 */
const OFF_TOPIC_OUTPUT_PATTERNS = [
  /\bpython\b/i,
  /\bjavascript\b/i,
  /\btypescript\b/i,
  /\bsource code\b/i,
  /\bwrite (a |the )?code\b/i,
  /\bprogramm/i,
  /\balgorithm\b/i,
  /\bpolitics\b/i,
  /\belection\b/i,
  /\bgovernment policy\b/i,
  /\bcovid\b/i,
  /\bvaccine\b/i,
  /\bmedical (advice|diagnosis|treatment)\b/i,
  /\bprescription\b/i,
  /\bbreaking news\b/i,
  /\bstock market\b/i,
  /\bshare price\b/i,
  /\bcryptocurren/i,
  /\bsexual\b/i,
  /\billegal\b/i,
]

export const isOutputSafe = (text: string): boolean =>
  !OFF_TOPIC_OUTPUT_PATTERNS.some((pattern) => pattern.test(text))

export const REFUSAL_MESSAGE =
  "I'm only able to help with checking stock and prices for our tyres. Please send a product name or SKU."

export const INPUT_REFUSAL_MESSAGE =
  "I can only help with tyre availability and pricing for our shop. Please send a tyre brand, size, or SKU."
