import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SheetsService } from '../sheets/sheets.service'
import { LlmService } from '../llm/llm.service'
import { LexiconStore } from '../llm/lexicon.store'
import {
  isInDomain,
  isConversational,
  isOutputSafe,
  INPUT_REFUSAL_MESSAGE,
  REFUSAL_MESSAGE,
} from '../llm/guardrails'
import {
  combineUserContext,
  extractProductQuery,
  needsSizeOrBrandPrompt,
} from '../llm/query.util'
import { ProductRow } from '../sheets/sheets.types'
import { getAvailabilityLabel } from '../common/stock.util'
import { ConversationStore } from './conversation.store'

const GRAPH_API_VERSION = 'v20.0'

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly sheetsService: SheetsService,
    private readonly llmService: LlmService,
    private readonly conversations: ConversationStore,
    private readonly lexiconStore: LexiconStore,
  ) {}

  async handleIncomingMessage(from: string, text: string): Promise<void> {
    this.logger.log(`Incoming message from ${from}: "${text}"`)

    // ── 1. Load session + session-aware input guardrail ─────────────────────
    const history = await this.conversations.getHistory(from)
    const inSession = history.length > 0

    // Refuse only off-topic FIRST-CONTACT messages (no session, no tyre signal, no greeting)
    if (!inSession && !isInDomain(text) && !isConversational(text)) {
      this.logger.debug('Input guardrail: off-topic first-contact, refusing')
      await this.sendTextMessage(from, INPUT_REFUSAL_MESSAGE)
      return
    }

    // ── 2. Look up product in Google Sheets (multi-turn context) ────────────
    const contextText = combineUserContext(history, text)
    const learnedFillers = this.lexiconStore.getLearnedFillers()
    const query = extractProductQuery(contextText, { learnedFillers })
    let productInfo = null

    try {
      productInfo = await this.sheetsService.findProductByCodeOrName(query)
      this.logger.debug(
        productInfo ? `Product found: ${productInfo.sku}` : `No product match for query: "${query}"`,
      )
    } catch (err) {
      this.logger.error('Sheets lookup failed', err)
    }

    void this.lexiconStore.recordQuery(from, text, query, productInfo !== null)

    const askForSize = !productInfo && needsSizeOrBrandPrompt(contextText, query)

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
        needsSizeOrBrandPrompt: askForSize,
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
    await this.conversations.append(from, text, reply)
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
}
