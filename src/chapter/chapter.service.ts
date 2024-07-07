import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChapterService {
  constructor(private prismaService: PrismaService) {}

  async findOne(chapterNumber: number, bookId: number) {
    try {
      const chapter = await this.prismaService.chapter.findUnique({
        where: {
          chapterNumber_bookId: {
            bookId: +bookId,
            chapterNumber: +chapterNumber,
          },
        },
        select: {
          bookId: true,
          chapterNumber: true,
          content: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          book: {
            select: {
              title: true,
              slug: true,
              thumbnail: true,
              anotherName: true,
              author: {
                select: {
                  name: true,
                  authorId: true
                }
              },
              postedBy: {
                select: {
                  name: true,
                  username: true
                }
              }
            }
          },
        },
      });
      if (!chapter?.bookId) {
        throw new Error('Error get chapter');
      }

      return {
        success: true,
        chapter: chapter,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async findAll(options: { bookId?: number, take?: number, skip?: number, sort?: "desc" | "asc" }) {
    try {
      const { bookId, take, skip, sort } = options;
      const chapters = await this.prismaService.chapter.findMany({
        where: {
          bookId: +bookId,
        },
        select: {
          bookId: true,
          title: true,
          chapterNumber: true,
          createdAt: true,
          updatedAt: true,
        }
      })
      return {
        success: true,
        chapters: chapters,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async findAllSeo() {
    try {
      const chapters = await this.prismaService.chapter.findMany({
        select: {
          bookId: true,
          chapterNumber: true,
          book: {
            select: {
              slug: true
            }
          },
          createdAt: true,
          updatedAt: true
        }
      });

      return {
        success: true,
        chapters: chapters,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

}
