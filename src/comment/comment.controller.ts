import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('/api/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @UseGuards(JwtGuard)
  @Post()
  createComment(@Request() req, @Body() createCommentDto: CreateCommentDto) {
    return this.commentService.createComment(req.user.userId, createCommentDto);
  }

  @Get('/')
  getComments(
    @Query('bookId') bookId?: number,
    @Query('parentId') parentId?: number,
    @Query('otherId') otherId?: number,
    @Query('chapterNumber') chapterNumber?: number,
    @Query('take') take?: number,
    @Query('skip') skip?: number,
  ) {
    return this.commentService.getComments({ otherId, parentId, bookId, chapterNumber, take, skip });
  }

  @UseGuards(JwtGuard)
  @Get('/notification')
  getNotification(
    @Request() req,
    @Query('take') take?: number,
    @Query('skip') skip?: number,
    @Query('sort') sort?: "desc" | "asc",
  ) {
    return this.commentService.getNotification({ user: req.user, skip: skip, take: take, sort: sort });
  }

  @Delete(':commentId')
  @UseGuards(JwtGuard)
  deleteComment(@Request() req, @Param('commentId') commentId: number) {
    return this.commentService.deleteComment({
      userId: req.user.userId,
      commentId: commentId,
    });
  }

  @Patch('/read/:commentId')
  @UseGuards(JwtGuard)
  readComment(@Request() req, @Param('commentId') commentId: number) {
    return this.commentService.readComment({
      userId: req.user.userId,
      commentId: commentId,
    });
  }
}
