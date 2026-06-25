import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { WhatsappModule } from './whatsapp/whatsapp.module'
import { SheetsModule } from './sheets/sheets.module'
import { LlmModule } from './llm/llm.module'
import { HealthModule } from './health/health.module'
import { validationSchema } from './config/env.validation'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    WhatsappModule,
    SheetsModule,
    LlmModule,
    HealthModule,
  ],
})
export class AppModule {}
