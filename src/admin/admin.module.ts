import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CloudImageService } from '../cloud-image/cloud-image.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [CacheModule.register({}),],
  controllers: [AdminController],
  providers: [AdminService, JwtService, CloudImageService],
})
export class AdminModule {}
