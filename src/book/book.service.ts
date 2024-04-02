import { Get, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class BookService {
  constructor(
    private prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(options: {
    q?: string;
    author?: string;
    genres?: string;
    notgenres?: string;
    take?: number;
    skip?: number;
    sort?: 'desc' | 'asc';
    otherId?: number;
  }) {
    const {
      q = '',
      author = '',
      genres,
      notgenres,
      take = 24,
      skip = 0,
      sort = 'desc',
      otherId,
    } = options;

    const cvQuery = `/api/books?genres=${genres}&notgenres=${notgenres || ''}&q=${q || ''}&take=${take || ''}&skip=${skip || ''}&sort=${sort || ''}&author=${author || ''}`;
    const cacheValue: any = await this.cacheManager.get(cvQuery);
    if (cacheValue) {
      return {
        success: true,
        cache: true,
        countBook: cacheValue?.countBook,
        books: cacheValue?.books,
      };
    }

    try {
      const haveTags = genres ? genres?.split(',') : null;
      const notTags = notgenres ? notgenres?.split(',') : null;

      let where: Prisma.BookWhereInput = {};
      if (haveTags) {
        where = {
          ...where,
          AND: haveTags.map((tagT) => ({
            tags: {
              some: {
                tagId: {
                  equals: tagT,
                },
              },
            },
          })),
        };
      }
      if (notTags) {
        where = {
          ...where,
          tags: {
            none: {
              tagId: {
                in: notTags,
              },
            },
          },
        };
      }
      if (q) {
        where = {
          ...where,
          title: {
            contains: q,
          },
        };
      }
      if(author) {
        where = {
          ...where,
          author: {
            name: author
          }
        }
      }
      const books = await this.prismaService.book.findMany({
        skip: +skip,
        take: +take,
        orderBy: {
          updatedAt: sort,
        },
        where: where,
        select: {
          bookId: true,
          title: true,
          slug: true,
          thumbnail: true,
          scrapedUrl: true,
          isGreatBook: true,
          chapters: {
            take: 2,
            orderBy: {
              chapterNumber: 'desc',
            },
            select: {
              chapterNumber: true,
              createdAt: true,
            },
          },
        },
      });

      const countBook = await this.prismaService.book.count({
        where: where,
      });

      await this.cacheManager.set(
        cvQuery,
        { countBook: countBook, books: books },
        60000,
      );

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

  async findOne(bookId: number) {
    try {
      const bookRes = await this.prismaService.book.findUnique({
        where: {
          bookId: +bookId,
        },
        select: {
          bookId: true,
          title: true,
          slug: true,
          anotherName: true,
          description: true,
          status: true,
          thumbnail: true,
          tags: true,
          author: {
            select: {
              name: true,
              authorId: true,
            },
          },
          postedBy: {
            select: {
              avatarUrl: true,
              role: true,
              name: true,
              username: true,
            },
          },
          chapters: {
            orderBy: {
              chapterNumber: 'desc',
            },
            select: {
              title: true,
              chapterNumber: true,
              _count: {
                select: {
                  views: true,
                },
              },
              createdAt: true,
              updatedAt: true,
            },
          },
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              chapters: true,
              userViews: true,
              usersFollow: true,
            },
          },
        },
      });

      return {
        success: true,
        book: bookRes,
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
      const books = await this.prismaService.book.findMany({
        select: {
          slug: true,
          bookId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        books: books,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async increaseViews({
    user,
    bookId,
    chapterNumber,
  }: {
    user?: null | { userId: number };
    bookId: number;
    chapterNumber: number;
  }) {
    try {
      if(user?.userId) {
        const keyCache = `user=${user?.userId}-bookId=${bookId}-chapterNumber=${chapterNumber}`;

        const cacheValue = await this.cacheManager.get(keyCache);
        if (!cacheValue) {
          await this.cacheManager.set(
            keyCache,
            "ping",
            15000,
          );
          await this.prismaService.user.update({
            where: {
              userId: user?.userId
            },
            data: {
              rank: {
                increment: 1
              },
              userViews: {
                create: {
                  bookId: +bookId,
                  chapterNumber: +chapterNumber,
                }
              }
            }
          })
          // await this.prismaService.userView.create({
          //   data: {
          //     bookId: +bookId,
          //     chapterNumber: +chapterNumber,
          //     userId: user ? user?.userId : null,
          //   },
          // });
  
          return {
            success: true,
            message: "Increase view successfully."
          };
        }

        return {
          success: true,
          message: "You are spamming."
        };
      }

      await this.prismaService.userView.create({
        data: {
          bookId: +bookId,
          chapterNumber: +chapterNumber,
          userId: user ? user?.userId : null,
        },
      });

      return {
        success: true,
        message: "Increase view successfully."
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async booksFollow(options: {
    user: { userId: number };
    take?: number,
    skip?: number,
    sort?: "desc" | "asc"
  }) {
    try {
      const {user, take = 24, skip = 0, sort = "desc"} = options;
      const books = await this.prismaService.userBookFollowModel.findMany({
        take: +take,
        skip: +skip,
        where: {
          userId: user?.userId
        },
        orderBy: {
          book: {
            updatedAt: sort
          }
        },
        include: {
          book: {
            select: {
              bookId: true,
              title: true,
              slug: true,
              thumbnail: true,
              scrapedUrl: true,
              isGreatBook: true,
              chapters: {
                take: 2,
                orderBy: {
                  chapterNumber: 'desc',
                },
                select: {
                  chapterNumber: true,
                  createdAt: true,
                },
              },
            }
          }
        }
      })
      // const books = await this.prismaService.book.findMany({
      //   skip: +skip,
      //   take: +take,
      //   where: {
          // userId: user?.userId,
        // },
        // orderBy: {

        // },
        // select: {
        //   chapters: {

        //   }
        // }
        // select: {
        //   book: {
        //     select: {
        //       bookId: true,
        //       title: true,
        //       slug: true,
        //       nameImage: true,
        //       thumbnail: true,
        //       scrapedUrl: true,
        //       isGreatBook: true,
        //       chapters: {
        //         take: 2,
        //         orderBy: {
        //           chapterNumber: 'desc',
        //         },
        //         select: {
        //           chapterNumber: true,
        //           createdAt: true,
        //         },
        //       },
        //     }
        //   }
        // },
      // });

      const countBook = await this.prismaService.userBookFollowModel.count({
        where: {
          userId: user?.userId,
        },
      });

      // await this.cacheManager.set(
      //   cvQuery,
      //   { countBook: countBook, books: books },
      //   60000,
      // );
      return {
        success: true,
        countPage: countBook,
        books: books
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async checkFollow({
    user,
    bookId,
  }: {
    user: { userId: number };
    bookId: number;
  }) {
    try {
      const book = await this.prismaService.userBookFollowModel.findUnique({
        where: {
          userId_bookId: {
            bookId: +bookId,
            userId: +user?.userId,
          },
        },
      });
      return {
        success: true,
        isFollowed: book ? true : false,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async actionFollow({
    user,
    bookId,
    type,
  }: {
    user: { userId: number };
    bookId: number;
    type: 'follow' | 'unfollow';
  }) {
    try {
      if (type === 'unfollow') {
        await this.prismaService.userBookFollowModel.delete({
          where: {
            userId_bookId: {
              userId: +user?.userId,
              bookId: +bookId,
            },
          },
        });
        return {
          success: true,
          message: 'unfollow',
        };
      } else if (type === 'follow') {
        await this.prismaService.userBookFollowModel.create({
          data: {
            userId: +user?.userId,
            bookId: +bookId,
          },
        });
        return {
          success: true,
          message: 'follow',
        };
      }
    } catch (error) {
      if(error.code === "") {
        return {
          success: true,
          message: type === 'follow' ? 'unfollow' : 'follow',
        };
      }
      return {
        success: false,
        error: error,
      };
    }
  }
}
