import axios from 'axios';
import * as cheerio from 'cheerio';
import userAgent from 'random-useragent';
import { Injectable } from '@nestjs/common';
import { listIdNettruyenToMyId } from '../constants/data';
import { textToSlug } from '../utils/textToSlug';
import { CrawlBookDTO } from './dto/crawl-book.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlChapterDTO } from './dto/crawl-chapter.dto';
import { CloudImageService } from '../cloud-image/cloud-image.service';
// import MockAdapter from "axios-mock-adapter"

@Injectable()
export class CrawlService {
  constructor(
    private prismaService: PrismaService,
    private cloudImage: CloudImageService,
  ) {}

  // Create Novel
  async createBook(userId: number, { type, bookUrl }: CrawlBookDTO) {
    try {
      const cvScrapedUrl = bookUrl.replace(new URL(bookUrl).origin + '/', '');
      try {
        // Crawl Data Novel
        const dataBook = await this.crawlBook(type, bookUrl.trim());
        if (!dataBook?.success) {
          throw new Error('Error crawling book');
        }

        // Create Book
        const {
          title,
          anotherName,
          author,
          description,
          status,
          tags,
          thumbnail,
          next,
        } = dataBook?.book;
        const cvNext = next
          ? dataBook?.book.next.replace(new URL(bookUrl).origin + '/', '')
          : null;

        // return {
        //   success: false,
        //   bookUrl: bookUrl,
        //   dataBook: dataBook,
        //   cvScrapedUrl,
        //   cvNext
        // };

        const bookRes = await this.prismaService.book.create({
          data: {
            title: title.replace('- LXMANGA', '').trim(),
            next: cvNext,
            status: status,
            type: type,
            slug: textToSlug(title),
            anotherName: anotherName,
            description: description,
            scrapedUrl: cvScrapedUrl,
            postedBy: {
              connect: {
                userId: userId,
              },
            },
          },
        });

        // Upload Thumbnail Novel
        const dataThumbnail = await this.cloudImage.uploadImageBookOnS3({
          url: thumbnail,
          bookId: bookRes?.bookId,
        });

        // Update Thumbnail, Tag And Author Book
        await this.prismaService.book.update({
          where: {
            bookId: bookRes?.bookId,
          },
          data: {
            thumbnail: dataThumbnail?.imageKey,
            author: {
              connectOrCreate: {
                where: {
                  name: author,
                },
                create: {
                  name: author,
                },
              },
            },
            tags: {
              deleteMany: {},
              create: tags?.map((tag) => ({
                tag: {
                  connectOrCreate: {
                    where: {
                      tagId: tag,
                    },
                    create: {
                      tagId: tag,
                    },
                  },
                },
              })),
            },
          },
        });

        return {
          success: true,
          type: type,
          book: {
            ...dataBook?.book,
            thumbnail: dataThumbnail?.imageKey,
          },
        };
      } catch (error) {
        if (error.code === 'P2002') {
          const book = await this.prismaService.book.findUnique({
            where: {
              type: type,
              scrapedUrl: cvScrapedUrl,
            },
          });
          return {
            success: true,
            exist: true,
            book: book,
          };
        }
        return {
          success: false,
          message: 'Error create book',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  // Create Chapters
  async createChapters(
    userId: number,
    { type = 'nettruyen', bookUrl, take = 1 }: CrawlChapterDTO,
  ) {
    try {
      const domain = new URL(bookUrl).origin;
      // Get Book
      const bookRes = await this.prismaService.book.findUnique({
        where: {
          type: type,
          scrapedUrl: bookUrl.replace(domain + '/', ''),
        },
        select: {
          bookId: true,
          next: true,
          chapters: {
            take: 2,
            orderBy: {
              chapterNumber: 'desc',
            },
            select: {
              next: true,
              chapterNumber: true,
            },
          },
          _count: {
            select: {
              chapters: true,
            },
          },
        },
      });
      if (!bookRes) {
        return {
          success: false,
          error: 'Error crawling chapters.',
        };
      }

      if (bookRes?.chapters.length > 0 && !bookRes?.chapters[0].next) {
        const dataChapter = await this.crawlChapter(
          type,
          bookRes?.chapters.length > 1
            ? domain + '/' + bookRes?.chapters[1].next
            : domain + '/' + bookRes?.next,
        );

        if (dataChapter?.success && !dataChapter?.next) {
          return {
            success: false,
            error: 'Currently at the latest chapter.',
          };
        }
        bookRes.chapters[0].next = dataChapter?.next.replace(domain + '/', '');
      }

      // Create Multiple Chapter
      const chapterRes = await this.createMultipleChaptersBook({
        type: type,
        take: +take,
        bookId: bookRes?.bookId,
        start: bookRes?._count.chapters,
        domain: domain,
        chapterUrl:
          bookRes?._count.chapters > 0
            ? bookRes?.chapters[0].next
            : bookRes?.next,
      });
      if (!chapterRes?.success) {
        return {
          success: false,
          error: 'Crawl error.',
        };
      }

      return {
        success: true,
        message: 'Create chapters successfully',
        chapters: chapterRes,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  // Create Multiple Chapters Book
  async createMultipleChaptersBook({
    start,
    take,
    type,
    domain,
    bookId,
    chapterUrl,
  }: {
    take: number;
    start: number;
    bookId: number;
    domain: string;
    chapterUrl: string;
    type: 'nettruyen';
  }) {
    let listChapter = [];
    let urlQuery = chapterUrl;

    try {
      for (let i = start + 1; i <= start + take; i++) {
        const dataChapter = await this.crawlChapter(
          type,
          domain + '/' + urlQuery,
        );
        if (!dataChapter?.success) {
          throw new Error(`Error crawling chapter ${i}: ${dataChapter?.error}`);
        }
        // return {
        //   success: true,
        //   chapterUrl,
        //   dataChapter,
        //   cvNext,
        //   domain: domain + "/" + urlQuery
        // };

        const imagesChapter = await this.cloudImage.uploadImagesChapterOnS3({
          bookId: bookId,
          domain: domain,
          chapterNumber: i,
          listUrl: dataChapter?.chapter.content,
        });

        if (!imagesChapter?.success || imagesChapter?.images.length === 0) {
          await this.cloudImage.deleteFolder(`books/${bookId}/chapters/${i}`);

          throw new Error(
            `Failed to create images for chapter ${i}: ${imagesChapter?.error}`,
          );
        }

        // Push Array Create Books
        const cvNext = dataChapter?.next
          ? dataChapter?.next.replace(domain + '/', '')
          : null;
        listChapter.push({
          next: cvNext,
          bookId: bookId,
          chapterNumber: i,
          title: dataChapter?.chapter.title.trim(),
          content: JSON.stringify(imagesChapter?.images),
        });

        // If the next chapter doesn't exist
        if (!cvNext) {
          break;
        }

        urlQuery = cvNext;
      }

      // Create Chapter Book
      const chapterRes = await this.prismaService.chapter.createMany({
        data: listChapter?.map((chapter) => chapter),
      });
      if (!chapterRes) {
        throw new Error(`Error creating chapters`);
      }

      // Update updatedAt of Book
      await this.prismaService.book.update({
        where: { bookId: bookId },
        data: { updatedAt: new Date() },
      });

      return {
        success: true,
        message: 'Create chapters successfully',
      };
    } catch (error) {
      if (listChapter?.length > 0) {
        try {
          const chapterRes = await this.prismaService.chapter.createMany({
            data: listChapter?.map((chapter) => chapter),
          });
          if (!chapterRes) {
            throw new Error('Error creating remaining chapters');
          }

          // Update updatedAt of Book
          await this.prismaService.book.update({
            where: { bookId: bookId },
            data: { updatedAt: new Date() },
          });
          return {
            success: true,
            message: 'Create chapters successfully',
          };
        } catch (remainingChaptersError) {
          return {
            success: false,
            error: `Error creating remaining chapters: ${remainingChaptersError?.message}`,
          };
        }
      }
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  // Crawl Book
  async crawlBook(type: 'nettruyen', url: string) {
    const baseUrl = new URL(url).origin;
    try {
      const response = await axios.get(url, {
        headers: {
          referer: baseUrl,
          'Sec-Ch-Ua':
            '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': 'Windows',
          'User-Agent': userAgent?.getRandom(),
        },
      });

      const $ = cheerio.load(response.data);
      let title = '';
      let thumbnail = null;
      let description = '';
      let anotherName = '';
      let status = 1;
      let author = '';
      let tags = [];
      let next = null;

      if (type === 'nettruyen') {
        title = $('title').text().split('- LXHENTAI')[0].trim();
        const urlMatch = /url\('([^']+)'\)/.exec(
          $('.rounded-lg.cover').attr('style'),
        );
        thumbnail = urlMatch ? urlMatch[1] : null;
        author = $('.mt-2 .text-blue-500').first().text();
        $(
          '.bg-gray-500.hover\\:bg-gray-600.text-white.rounded.px-2.text-sm.inline-block',
        ).each((index, element) => {
          const tag = $(element).text().trim();
          if (listIdNettruyenToMyId[tag]) {
            tags.push(listIdNettruyenToMyId[tag]);
          }
        });
        next = $('.overflow-y-auto.overflow-x-hidden>a').last().attr('href');
      }

      return {
        success: true,
        book: {
          title: title,
          thumbnail: thumbnail,
          description: description,
          anotherName: anotherName,
          status: status,
          author: author,
          tags: tags,
          next: next.length > 0 ? new URL(url).origin + next : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error,
      };
    }
  }

  // Crawl Chapter
  async crawlChapter(type: 'nettruyen', url: string) {
    try {
      const baseUrl = new URL(url).origin;
      const response = await axios.get(url, {
        headers: {
          referer: baseUrl,
          'Sec-Ch-Ua':
            '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': 'Windows',
          'User-Agent': userAgent?.getRandom(),
        },
      });
      const $ = cheerio.load(response.data);

      let title = '';
      let content = [];
      let next = null;

      if (type === 'nettruyen') {
        title = '';
        content = $('.lazy.max-w-full.my-0.mx-auto')
          .map((index, element) => $(element).attr('src'))
          .get();
        let nextChapter = $('a#btn-next').attr('href');
        next =
          nextChapter === 'javascript:nm5213(0)'
            ? null
            : new URL(url).origin + nextChapter;
      }
      return {
        success: true,
        next: next,
        chapter: {
          title: title,
          content: content,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }
}
