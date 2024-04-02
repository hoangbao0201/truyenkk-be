import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { BookModule } from './book/book.module';
import { ChapterModule } from './chapter/chapter.module';
import { CommentModule } from './comment/comment.module';
import { AdminModule } from './admin/admin.module';
import { CloudImageModule } from './cloud-image/cloud-image.module';
import { CrawlModule } from './crawl/crawl.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    BookModule,
    ChapterModule,
    CommentModule,
    AdminModule,
    CloudImageModule,
    CrawlModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
