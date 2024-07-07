import { Server } from 'https';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Prisma } from '@prisma/client';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  constructor(
    private prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @WebSocketServer() server: Server;
  private users: Map<string, string> = new Map();
  
  @SubscribeMessage('count-member')
  handleGetCountMember() {
    this.server.emit('countMember', {
      success: true,
      countMember: this.users.size
    });
  }

  @SubscribeMessage('connect')
  handleConnection(data) {
    this.users.set(data.conn.id, "1");
    this.server.emit('countMember', {
      success: true,
      countMember: this.users.size
    });
  }
  
  @SubscribeMessage('disconnect')
  handleDisconnect(data) {
    this.users.delete(data.conn.id);
    this.server.emit('countMember', {
      success: true,
      countMember: this.users.size
    });
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody()
    message: {
      sender: {
        userId: number;
        name: string;
        username: string;
        role: 'admin' | 'guest' | 'editor';
        item: number;
        rank: number;
        avatarUrl: string;
      } | null;
      image?: string
      chatText: string;
      socketId: string;
      createdAt: Date
    },
    payload: any,
  ): Promise<void> {
    const { sender, chatText, socketId, image, createdAt } = message;

    const keyMessage = 'messages-' + socketId;
    const cacheCountMessage: any = await this.cacheManager.get(keyMessage);
    if(!cacheCountMessage) {
      await this.cacheManager.set(keyMessage, 1, 2*24*60*60000);
    }
    else {
      const countMessage = parseInt(cacheCountMessage);
      if(countMessage > 10) {
        this.server.emit('message', {
          success: false,
          error: "Bạn đang hành động quá nhanh",
        });
        return;
      }
      await this.cacheManager.set(keyMessage, countMessage + 1, 30000);
    }

    let dataCreateChat: Prisma.ChatCreateInput = {
      chatText: chatText,
      socketId: socketId,
    };
    if(sender) {
      dataCreateChat = {
        ...dataCreateChat,
        sender: {
          connect: {
            userId: sender?.userId
          }
        },
      }
    }
    if(image) {
      dataCreateChat = {
        ...dataCreateChat,
        image: image
      }
    }
    const createChatRes = await this.prismaService.chat.create({
      data: dataCreateChat,
      select: {
        chatId: true,
      }
    });
    if(createChatRes) {
      try {
        await this.prismaService.chat.delete({
          where: {
            chatId: createChatRes?.chatId - 20
          }
        })
      } catch (error) {
        
      }
    }
    
    this.server.emit('message', {
      success: true,
      message: {
        sender: sender,
        image,
        chatText: chatText,
        socketId: socketId,
        createdAt: createdAt,
        chatId: new Date().toISOString(),
        // chatId: createChatRes.chatId,
      },
    });
  };
}
