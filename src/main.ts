import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)

  app.enableShutdownHooks()
  app.use(helmet())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))

  const port = process.env.PORT ?? 3000
  await app.listen(port, '0.0.0.0')
  logger.log(`WhatsApp Tyre Bot listening on port ${port}`)
}

bootstrap()
