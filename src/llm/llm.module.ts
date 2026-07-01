import { Module } from '@nestjs/common'
import { LlmService } from './llm.service'
import { LexiconStore } from './lexicon.store'

@Module({
  providers: [LlmService, LexiconStore],
  exports: [LlmService, LexiconStore],
})
export class LlmModule {}
