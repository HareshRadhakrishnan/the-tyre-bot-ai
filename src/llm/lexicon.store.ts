import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../database/database.module'
import { BRANDS, DOMAIN_KEYWORDS_EN, DOMAIN_KEYWORDS_SINGLISH, DOMAIN_KEYWORDS_TANGLISH } from './lexicon'

const PROMOTE_THRESHOLD = 3
const REFRESH_INTERVAL_MS = 5 * 60 * 1000

const SKIP_LEARNING = new Set([
  ...BRANDS,
  ...DOMAIN_KEYWORDS_EN,
  ...DOMAIN_KEYWORDS_SINGLISH,
  ...DOMAIN_KEYWORDS_TANGLISH,
  'tyre',
  'tyres',
  'tire',
  'tires',
])

@Injectable()
export class LexiconStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LexiconStore.name)
  private learnedFillers: string[] = []
  private refreshTimer?: ReturnType<typeof setInterval>

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS learned_lexicon (
        word         VARCHAR(50) PRIMARY KEY,
        category     VARCHAR(20)  NOT NULL DEFAULT 'filler',
        occurrences  INT          NOT NULL DEFAULT 1,
        first_seen_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS query_logs (
        id              SERIAL PRIMARY KEY,
        phone           VARCHAR(30),
        raw_text        TEXT         NOT NULL,
        extracted_query TEXT,
        product_found   BOOLEAN      DEFAULT FALSE,
        created_at      TIMESTAMPTZ  DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS query_logs_created_idx
        ON query_logs (created_at DESC)
    `)

    await this.loadLearned()
    this.refreshTimer = setInterval(() => {
      void this.loadLearned()
    }, REFRESH_INTERVAL_MS)

    this.logger.log(`Lexicon learning ready — ${this.learnedFillers.length} promoted filler(s)`)
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
  }

  getLearnedFillers(): readonly string[] {
    return this.learnedFillers
  }

  async recordQuery(
    phone: string,
    rawText: string,
    extractedQuery: string,
    productFound: boolean,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO query_logs (phone, raw_text, extracted_query, product_found)
       VALUES ($1, $2, $3, $4)`,
      [phone, rawText, extractedQuery, productFound],
    )

    if (!productFound && extractedQuery.trim()) {
      await this.learnTokensFromQuery(extractedQuery)
    }
  }

  private async loadLearned(): Promise<void> {
    const { rows } = await this.pool.query<{ word: string }>(
      `SELECT word FROM learned_lexicon
        WHERE category = 'filler' AND occurrences >= $1
        ORDER BY occurrences DESC`,
      [PROMOTE_THRESHOLD],
    )
    this.learnedFillers = rows.map((r) => r.word)
  }

  private async learnTokensFromQuery(extracted: string): Promise<void> {
    const tokens = extracted
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3)

    for (const token of tokens) {
      if (/^\d/.test(token) || /^tyr-/i.test(token)) continue
      if (SKIP_LEARNING.has(token)) continue
      if (/^r\d{2}$/i.test(token)) continue

      await this.pool.query(
        `INSERT INTO learned_lexicon (word, category, occurrences)
         VALUES ($1, 'filler', 1)
         ON CONFLICT (word) DO UPDATE SET
           occurrences = learned_lexicon.occurrences + 1,
           last_seen_at = NOW()`,
        [token],
      )
    }

    await this.loadLearned()
  }
}
