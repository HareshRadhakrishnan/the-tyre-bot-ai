import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google, sheets_v4 } from 'googleapis'
import { ProductRow } from './sheets.types'

const CACHE_TTL_MS = 60_000

@Injectable()
export class SheetsService implements OnModuleInit {
  private readonly logger = new Logger(SheetsService.name)
  private sheetsClient!: sheets_v4.Sheets
  private cache: ProductRow[] = []
  private cacheExpiry = 0

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const email = this.config.getOrThrow<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    const rawKey = this.config.getOrThrow<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
    const privateKey = rawKey.replace(/\\n/g, '\n')

    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    this.sheetsClient = google.sheets({ version: 'v4', auth })
    this.logger.log('Google Sheets client initialised')
  }

  async findProductByCodeOrName(query: string): Promise<ProductRow | null> {
    const rows = await this.getRows()
    const q = query.toLowerCase().trim()

    const match = rows.find(
      (r) =>
        r.sku.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        q.includes(r.sku.toLowerCase()),
    )

    return match ?? null
  }

  private async getRows(): Promise<ProductRow[]> {
    if (Date.now() < this.cacheExpiry && this.cache.length > 0) {
      return this.cache
    }

    const sheetId = this.config.getOrThrow<string>('GOOGLE_SHEET_ID')
    const range = this.config.get<string>('GOOGLE_SHEET_RANGE', 'Sheet1!A:D')

    const response = await this.sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    })

    const rawRows = response.data.values ?? []

    // Skip header row (row 0 is assumed to be SKU, Name, Stock, Price)
    const dataRows = rawRows.slice(1)

    this.cache = dataRows
      .filter((row) => row.length >= 4 && row[0])
      .map((row) => ({
        sku: String(row[0]).trim(),
        name: String(row[1]).trim(),
        stock: Number(row[2]) || 0,
        price: Number(row[3]) || 0,
      }))

    this.cacheExpiry = Date.now() + CACHE_TTL_MS
    this.logger.debug(`Loaded ${this.cache.length} products from Sheets (cache refreshed)`)

    return this.cache
  }
}
