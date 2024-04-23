import { Server } from 'https';
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  @WebSocketServer() server: Server;

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() message: string, payload: any): Promise<void> {
    await this.cacheManager.set('messages-' + new Date().toISOString(), message, 10*60000);

    this.server.emit('message', {
      success: true,
      message: message
    });
  }

}
