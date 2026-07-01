export interface ProductInfo {
  sku?: string
  name?: string
  stock?: number
  price?: number
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateReplyParams {
  userMessage: string
  productInfo: ProductInfo | null
  businessName: string
  history?: ConversationTurn[]
  needsSizeOrBrandPrompt?: boolean
}
