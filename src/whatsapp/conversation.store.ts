export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  messages: ConversationMessage[]
  updatedAt: number
}

const SESSION_TTL_MS = 30 * 60 * 1000  // 30 minutes of inactivity clears context
const MAX_HISTORY_PAIRS = 6            // keep last 6 exchanges (12 messages) to cap tokens

export class ConversationStore {
  private readonly sessions = new Map<string, Session>()

  getHistory(phoneNumber: string): ConversationMessage[] {
    const session = this.sessions.get(phoneNumber)
    if (!session) return []

    if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
      this.sessions.delete(phoneNumber)
      return []
    }

    return session.messages
  }

  append(phoneNumber: string, userMessage: string, assistantReply: string): void {
    const existing = this.getHistory(phoneNumber)

    const updated: ConversationMessage[] = [
      ...existing,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantReply },
    ]

    // Keep only the most recent N pairs
    const trimmed = updated.slice(-MAX_HISTORY_PAIRS * 2)

    this.sessions.set(phoneNumber, { messages: trimmed, updatedAt: Date.now() })
  }

  clear(phoneNumber: string): void {
    this.sessions.delete(phoneNumber)
  }
}
