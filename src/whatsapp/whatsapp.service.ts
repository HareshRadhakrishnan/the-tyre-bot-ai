import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SheetsService } from '../sheets/sheets.service'
import { LlmService } from '../llm/llm.service'
import {
  isInDomain,
  isConversational,
  isOutputSafe,
  INPUT_REFUSAL_MESSAGE,
  REFUSAL_MESSAGE,
} from '../llm/guardrails'
import { ProductRow } from '../sheets/sheets.types'
import { getAvailabilityLabel } from '../common/stock.util'
import { ConversationStore } from './conversation.store'

const GRAPH_API_VERSION = 'v20.0'

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name)
  private readonly conversations = new ConversationStore()

  constructor(
    private readonly config: ConfigService,
    private readonly sheetsService: SheetsService,
    private readonly llmService: LlmService,
  ) {}

  async handleIncomingMessage(from: string, text: string): Promise<void> {
    this.logger.log(`Incoming message from ${from}: "${text}"`)

    // ── 1. Load session + session-aware input guardrail ─────────────────────
    const history = this.conversations.getHistory(from)
    const inSession = history.length > 0

    // Refuse only off-topic FIRST-CONTACT messages (no session, no tyre signal, no greeting)
    if (!inSession && !isInDomain(text) && !isConversational(text)) {
      this.logger.debug('Input guardrail: off-topic first-contact, refusing')
      await this.sendTextMessage(from, INPUT_REFUSAL_MESSAGE)
      return
    }

    // ── 2. Look up product in Google Sheets ─────────────────────────────────
    const query = this.extractProductQuery(text)
    let productInfo = null

    try {
      productInfo = await this.sheetsService.findProductByCodeOrName(query)
      this.logger.debug(
        productInfo ? `Product found: ${productInfo.sku}` : 'No product match in Sheets',
      )
    } catch (err) {
      this.logger.error('Sheets lookup failed', err)
    }

    // ── 3. Generate LLM reply (with conversation history) ───────────────────
    const businessName = this.config.get<string>('BOT_BUSINESS_NAME', 'Our Tyre Shop')
    this.logger.debug(`Conversation history for ${from}: ${history.length} messages`)

    let reply: string

    try {
      reply = await this.llmService.generateReply({
        userMessage: text,
        productInfo,
        businessName,
        history,
      })
    } catch (err) {
      this.logger.error('LLM call failed', err)
      reply = productInfo
        ? this.buildDirectProductReply(productInfo)
        : REFUSAL_MESSAGE
    }

    // ── 4. Output guardrail ─────────────────────────────────────────────────
    if (!isOutputSafe(reply)) {
      this.logger.warn('Output guardrail triggered — LLM reply deemed unsafe, overriding')
      reply = REFUSAL_MESSAGE
    }

    // ── 5. Persist exchange THEN send (so history survives even if send fails) ─
    this.conversations.append(from, text, reply)
    await this.sendTextMessage(from, reply)
  }

  async sendTextMessage(to: string, body: string): Promise<void> {
    const token = this.config.getOrThrow<string>('WHATSAPP_TOKEN')
    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID')

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      this.logger.error(`WhatsApp API error ${response.status}: ${errorText}`)
      throw new Error(`WhatsApp send failed: ${response.status}`)
    }

    this.logger.debug(`Message sent to ${to}`)
  }

  /**
   * Fallback reply when the LLM is unavailable — formats raw product
   * data into a readable WhatsApp message directly.
   */
  private buildDirectProductReply(p: ProductRow): string {
    return `*${p.name}*\nAvailability: ${getAvailabilityLabel(p.stock)}\nPrice: Rs ${p.price}`
  }

  /**
   * Extracts and normalises the most likely product identifier from a
   * free-text message, then returns a string suitable for a Sheets lookup.
   *
   * Tyre size notation customers use (all normalised to "WWW/HH RDD"):
   *   205/55 R16   — standard with R
   *   205/55R16    — standard no space
   *   205/55 16    — no R prefix
   *   205-55-16    — dash-separated
   *   20555r16     — no separators
   */
  private extractProductQuery(text: string): string {
    const normalized = this.normalizeTyreSize(text)
    if (normalized) return normalized

    // Match SKU-like tokens (e.g. TYR-MRF-1556514)
    const skuMatch = text.match(/\bTYR-[A-Z]+-\d+\b/i)
    if (skuMatch) return skuMatch[0]

    // Fallback: strip common filler words and return the cleaned text
    return text
      .replace(/\b(do you have|is|are|any|please|hi|hello|the|a|an|for|of|in|stock|available|check|want|need|looking|get|give|me|i)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  /**
   * Tries to detect a tyre size in the message (with or without "R")
   * and returns the canonical "WWW/HH RDD" form, or null if not found.
   */
  private normalizeTyreSize(text: string): string | null {
    // Already canonical: 205/55 R16 or 205/55R16
    const canonical = text.match(/\b(\d{3})\/(\d{2})\s*[Rr](\d{2})\b/)
    if (canonical) return `${canonical[1]}/${canonical[2]} R${canonical[3]}`

    // Missing R: "205/55 16" or "205-55-16" or "205/55-16"
    const noR = text.match(/\b(\d{3})[\/\-](\d{2})\s*[\/\-\s](\d{2})\b/)
    if (noR) return `${noR[1]}/${noR[2]} R${noR[3]}`

    // Space-separated digits only: "205 55 16"
    const spaceSep = text.match(/\b(1[4-9]\d|2\d{2})\s+(3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9])\s+(1[3-9]|2[0-2])\b/)
    if (spaceSep) return `${spaceSep[1]}/${spaceSep[2]} R${spaceSep[3]}`

    return null
  }
}
