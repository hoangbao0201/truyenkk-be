import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CrawlService } from './crawl.service';
import { CrawlController } from './crawl.controller';
import { CloudImageService } from '../cloud-image/cloud-image.service';

@Module({
  controllers: [CrawlController],
  providers: [CrawlService, JwtService, CloudImageService],
})
export class CrawlModule {}
