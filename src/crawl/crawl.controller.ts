import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { CrawlService } from './crawl.service';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('/api/crawl')
export class CrawlController {
  constructor(private readonly crawlService: CrawlService) {}

  @UseGuards(JwtGuard)
  @Post('/book')
  createBook(
    @Request() req,
    @Body('bookUrl') bookUrl: string,
    @Body('type') type: "nettruyen",
  ) {
    return this.crawlService.createBook(req.user.userId, {
      type: type,
      bookUrl: bookUrl,
    });
  }

  @UseGuards(JwtGuard)
  @Post('/chapter')
  createChapters(
    @Request() req,
    @Body('type') type: "nettruyen",
    @Body('take') take: number,
    @Body('bookUrl') bookUrl: string,
  ) {
    return this.crawlService.createChapters(req.user.userId, {
      type: type,
      take: +take || 1,
      bookUrl: bookUrl,
    });
  }

}
