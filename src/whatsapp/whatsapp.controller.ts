import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  Logger,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ThrottlerGuard, Throttle } from '@nestjs/throttler'
import { Response } from 'express'
import { WhatsappService } from './whatsapp.service'
import { WhatsappWebhookBody } from './whatsapp.types'

@Controller('webhook')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name)

  constructor(
    private readonly config: ConfigService,
    private readonly whatsappService: WhatsappService,
  ) {}

  /**
   * GET /webhook
   * Meta webhook verification challenge.
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = this.config.getOrThrow<string>('VERIFY_TOKEN')

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully')
      res.status(200).send(challenge)
      return
    }

    this.logger.warn(`Webhook verification failed — mode: ${mode}, token: ${token}`)
    res.status(403).send('Forbidden')
  }

  /**
   * POST /webhook
   * Receives incoming WhatsApp Cloud API events.
   * Always responds 200 immediately (Meta requires this within 15 s).
   */
  @Post()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async receiveWebhook(@Body() body: WhatsappWebhookBody): Promise<string> {
    if (body.object !== 'whatsapp_business_account') {
      return 'ok'
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? []

        for (const message of messages) {
          if (message.type !== 'text' || !message.text?.body) continue

          const from = message.from
          const text = message.text.body

          // Fire and forget — do not await so Meta gets 200 immediately
          this.whatsappService.handleIncomingMessage(from, text).catch((err) =>
            this.logger.error(`handleIncomingMessage error for ${from}`, err),
          )
        }
      }
    }

    return 'ok'
  }
}
