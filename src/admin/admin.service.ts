import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudImageService } from '../cloud-image/cloud-image.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import userAgent from 'random-useragent';
import * as https from 'https'

@Injectable()
export class AdminService {
  constructor(
    private prismaService: PrismaService,
    private cloudImage: CloudImageService,
  ) {}

  async findAllBooks(
    user: { userId: number; username: string; role: { name: string } },
    options: { take?: number; skip?: number; sort?: 'desc' | 'asc' },
  ) {
    if (user?.role.name !== 'admin') {
      return {
        success: false,
        error: 'You are not an admin',
      };
    }

    const { take = 24, skip = 0, sort = 'desc' } = options;

    try {
      const books = await this.prismaService.book.findMany({
        take: +take,
        skip: +skip,
        orderBy: {
          updatedAt: sort,
        },
        select: {
          type: true,
          title: true,
          bookId: true,
          thumbnail: true,
          scrapedUrl: true,
          isGreatBook: true,
          _count: {
            select: {
              chapters: true,
            },
          },
        },
      });

      const countBook = await this.prismaService.book.count({});

      return {
        success: true,
        countBook: countBook,
        books: books,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async updateBook(
    user: { userId: number; username: string; role: { name: string } },
    book: { bookId: number; title: string; isGreatBook: boolean },
  ) {
    if (user?.role.name !== 'admin') {
      return {
        success: false,
        error: 'You are not an admin',
      };
    }

    try {
      const { bookId, title, isGreatBook } = book;
      const bookRes = await this.prismaService
        .$executeRaw`UPDATE Book SET isGreatBook = ${isGreatBook} WHERE bookId = ${bookId};`;

      return {
        success: true,
        book: bookRes,
        bookData: { bookId, title, isGreatBook },
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async deleteBook(
    user: { userId: number; username: string; role: { name: string } },
    bookId: number,
  ) {
    if (user?.role.name !== 'admin') {
      return {
        success: false,
        error: 'You are not an admin',
      };
    }
    try {
      const deleteBook = await this.prismaService.book.delete({
        where: {
          bookId: +bookId,
          postedBy: {
            userId: user.userId,
          },
        },
      });
      await this.cloudImage.deleteFolder(`truyenkk/books/${bookId}`);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async getViews(user: {
    userId: number;
    username: string;
    role: { name: string };
  }) {
    if (user?.role.name !== 'admin') {
      return {
        success: false,
        error: 'You are not an admin',
      };
    }
    try {
      const countView = await this.prismaService.userView.count({});

      // const lastDate = Date.now() - 24 * 60 * 60 * 1000;
      // const views = await this.prismaService.userView.findMany({
      //   where: {
      //     createdAt: {
      //       gte: new Date(lastDate),
      //     },
      //   },
      //   select: {

      //   }
      // })
      // const views = await this.prismaService.$executeRaw`SELECT * FROM 'UserView'`;
      // -- FROM UserView
      // -- WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      // -- GROUP BY HOUR(createdAt)
      // -- ORDER BY hour;

      return {
        success: true,
        countView: countView,
        // views: 1,
        // test: views,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async getUsers(user: {
    userId: number;
    username: string;
    role: { name: string };
  }) {
    if (user?.role.name !== 'admin') {
      return {
        success: false,
        error: 'You are not an admin',
      };
    }
    try {
      const users = await this.prismaService.user.findMany({
        take: 5,
        skip: 0,
        where: {
          NOT: {
            userId: user?.userId,
          },
        },
        orderBy: {
          rank: 'desc',
        },
        select: {
          userId: true,
          name: true,
          username: true,
          email: true,
          rank: true,
        },
      });

      const countUser = await this.prismaService.user.count({});
      return {
        success: true,
        countUser: countUser,
        users: users,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  // https://webcache.googleusercontent.com/search?q=cache:
  async test(bookId: number) {
    try {
      // const image = await this.cloudImage.uploadImageBookOnS3({
      //   url: "st.nettruyentt.com/data/comics/161/ta-la-ta-de-3254.jpg",
      //   bookId: 111111111
      // })

      const book = await this.prismaService.chapter.findUnique({
        where: {
          chapterNumber_bookId: {
            bookId: 21,
            chapterNumber: 5
          },
        },
        // data: {
        //   next: "truyen-tranh/ta-la-ta-de/chap-6/546292"
        // }
      })

      return {
        success: true,
        book: book
        // image: image
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }
}
