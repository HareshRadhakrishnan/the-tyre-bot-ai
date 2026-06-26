import { Module } from '@nestjs/common'
import { WhatsappController } from './whatsapp.controller'
import { WhatsappService } from './whatsapp.service'
import { ConversationStore } from './conversation.store'
import { SheetsModule } from '../sheets/sheets.module'
import { LlmModule } from '../llm/llm.module'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [SheetsModule, LlmModule, DatabaseModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, ConversationStore],
})
export class WhatsappModule {}
