import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../database/database.module'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// How many messages (not pairs) to feed into LLM context per request
const MAX_HISTORY = 20

@Injectable()
export class ConversationStore implements OnModuleInit {
  private readonly logger = new Logger(ConversationStore.name)

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id        SERIAL PRIMARY KEY,
        phone     VARCHAR(30)  NOT NULL,
        role      VARCHAR(10)  NOT NULL,
        content   TEXT         NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS messages_phone_created_idx
        ON messages (phone, created_at DESC)
    `)
    this.logger.log('Messages table ready')
  }

  async getHistory(phone: string): Promise<ConversationMessage[]> {
    const { rows } = await this.pool.query<{ role: string; content: string }>(
      `SELECT role, content
         FROM (
           SELECT role, content, created_at
             FROM messages
            WHERE phone = $1
            ORDER BY created_at DESC
            LIMIT $2
         ) sub
        ORDER BY created_at ASC`,
      [phone, MAX_HISTORY],
    )
    return rows as ConversationMessage[]
  }

  async append(phone: string, userMessage: string, assistantReply: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO messages (phone, role, content)
       VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
      [phone, userMessage, assistantReply],
    )
  }

  async clear(phone: string): Promise<void> {
    await this.pool.query('DELETE FROM messages WHERE phone = $1', [phone])
  }
}
