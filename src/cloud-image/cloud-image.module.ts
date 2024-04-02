import { Module } from '@nestjs/common';
import { CloudImageService } from './cloud-image.service';
import { CloudImageController } from './cloud-image.controller';

@Module({
  controllers: [CloudImageController],
  providers: [CloudImageService],
})
export class CloudImageModule {}
