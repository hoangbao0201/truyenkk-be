import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({}),
  ],
  providers: [ChatGateway],
  controllers: [ChatController],
})
export class ChatModule {}
