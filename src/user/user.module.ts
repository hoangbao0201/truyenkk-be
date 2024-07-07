import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { JwtService } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [CacheModule.register({}),],
  controllers: [UserController],
  providers: [UserService, JwtService],
})
export class UserModule {}
