import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { CacheModule } from '@nestjs/cache-manager';
import { ChatController } from './chat.controller';

@Module({
    imports: [CacheModule.register({}),],
    providers: [ChatGateway],
    controllers: [ChatController]
})
export class ChatModule {}
