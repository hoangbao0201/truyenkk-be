import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { BookService } from './book.service';
import { PipGuard } from '../auth/guard/pip.guard';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('/api/books')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // Get All
  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('author') author?: string,
    @Query('genres') genres?: string,
    @Query('notgenres') notgenres?: string,
    @Query('take') take?: number,
    @Query('skip') skip?: number,
    @Query('otherId') otherId?: number,
    @Query('sort') sort?: 'desc' | 'asc',
  ) {
    return this.bookService.findAll({ q, author, genres, notgenres, take: take, skip: skip, sort, otherId });
  }

  // Get Books Seo
  @Get('/seo')
  findAllSeo() {
    return this.bookService.findAllSeo();
  }

  // Increase View Book
  @UseGuards(PipGuard)
  @Post("/increase/views/:bookId/:chapterNumber")
  increaseViews(
    @Request() req,
    @Param("bookId") bookId: number,
    @Param("chapterNumber") chapterNumber: number,
  ){
    return this.bookService.increaseViews({ user: req.user, bookId, chapterNumber });
  }

  // Get All Book follow
  @UseGuards(JwtGuard)
  @Get("/follow")
  bookFollow(
    @Request() req,
    @Query('take') take?: number,
    @Query('skip') skip?: number,
    @Query('sort') sort?: 'desc' | 'asc',
  ){
    return this.bookService.booksFollow({ user: req.user, take, skip, sort });
  }

  // Check Follow Book
  @UseGuards(JwtGuard)
  @Get("/follow/:bookId")
  checkFollow(
    @Request() req,
    @Param("bookId") bookId: number,
  ){
    return this.bookService.checkFollow({ user: req.user, bookId });
  }

  // Action Follow Book
  @UseGuards(JwtGuard)
  @Post("/follow/:bookId")
  follow(
    @Request() req,
    @Param("bookId") bookId: number,
    @Query('type') type: "follow" | "unfollow"
  ){
    return this.bookService.actionFollow({ user: req.user, bookId, type });
  }

  // Get One Book
  @Get("/:bookId")
  findOne(
    @Param("bookId") bookId: number
  ){
    return this.bookService.findOne(bookId);
  }

}
