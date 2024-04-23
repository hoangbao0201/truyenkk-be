import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Controller, Get, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Controller('/api/chat')
export class ChatController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @Get('/messages')
  async findAllMessage() {
    const messageList = await this.getMultipleMessage('*' + 'message' + '*');

    // console.log("===== Get =====");
    console.log("messageList: ", messageList)

    return {
      success: true,
      messages: messageList,
    };
  }

  async getKeys(key: string): Promise<any> {
    return await this.cacheManager.store.keys(key);
  }

  async getValue(key: string): Promise<string> {
    return await this.cacheManager.get(key);
  }

  async getMultipleMessage(key: string): Promise<any> {
    const listKeys = await this.getKeys(key);
    const messageKeys = listKeys.filter(key => key.startsWith('messages-'));
    const data = [];
    for (const key of messageKeys) {
      const message = await this.getValue(key);
      data.push(message);
    }
    return data;
  }
}
