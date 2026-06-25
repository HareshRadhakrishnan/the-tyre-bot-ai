import { Module } from '@nestjs/common'
import { WhatsappController } from './whatsapp.controller'
import { WhatsappService } from './whatsapp.service'
import { SheetsModule } from '../sheets/sheets.module'
import { LlmModule } from '../llm/llm.module'

@Module({
  imports: [SheetsModule, LlmModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
