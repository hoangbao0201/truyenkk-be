import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';
import { JwtService } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [CacheModule.register({}),],
  controllers: [BookController],
  providers: [BookService, JwtService],
})
export class BookModule {}
