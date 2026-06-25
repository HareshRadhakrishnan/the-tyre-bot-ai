export interface WhatsappWebhookBody {
  object: string
  entry: WebhookEntry[]
}

interface WebhookEntry {
  id: string
  changes: WebhookChange[]
}

interface WebhookChange {
  value: WebhookValue
  field: string
}

interface WebhookValue {
  messaging_product: string
  metadata: {
    display_phone_number: string
    phone_number_id: string
  }
  contacts?: WebhookContact[]
  messages?: WebhookMessage[]
  statuses?: unknown[]
}

interface WebhookContact {
  profile: { name: string }
  wa_id: string
}

export interface WebhookMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
}
