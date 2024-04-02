import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChapterService } from './chapter.service';

@Controller('/api/chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}
  
  @Get('/seo')
  findAllSeo() {
    return this.chapterService.findAllSeo();
  }

  @Get('/:chapterNumber/:bookId')
  findOne(
    @Param('chapterNumber') chapterNumber: number,
    @Param('bookId') bookId: number,
  ) {
    return this.chapterService.findOne(chapterNumber, bookId);
  }

  @Get('/')
  findAll(
    @Query('bookId') bookId?: number,
    @Query('take') take?: number,
    @Query('skip') skip?: number,
    @Query('sort') sort?: 'desc' | 'asc',
  ) {
    return this.chapterService.findAll({ bookId, take, skip, sort });
  }
}
