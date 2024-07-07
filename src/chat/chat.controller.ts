import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { Controller, Get, Inject } from '@nestjs/common';

@Controller('/api/chat')
export class ChatController {
  constructor(
    private prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get('/messages')
  async findAllMessage() {
    const messages = await this.prismaService.chat.findMany({
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        chatId: true,
        chatText: true,
        image: true,
        socketId: true,
        createdAt: true,
        sender: {
          select: {
            userId: true,
            name: true,
            username: true,
            role: {
              select: {
                roleName: true,
              },
            },
            item: true,
            rank: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      messages: JSON.stringify(messages.reverse()),
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
    const messageKeys = listKeys.filter((key) => key.startsWith('messages-'));

    const data = [];
    for (const key of messageKeys) {
      const message = await this.getValue(key);
      data.push(message);
    }

    function compareMessages(a, b) {
      return a.messageId - b.messageId;
    }

    return data.sort(compareMessages);
  }
}
