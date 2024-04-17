import axios from 'axios';
import * as cheerio from 'cheerio';
import userAgent from 'random-useragent';
import { Injectable } from '@nestjs/common';
import { textToSlug } from '../utils/textToSlug';
import { CrawlBookDTO } from './dto/crawl-book.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlChapterDTO } from './dto/crawl-chapter.dto';
import { CloudImageService } from '../cloud-image/cloud-image.service';
import { listIdToData } from '../constants/data';

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

        // return {
        //   success: true,
        //   book: {
        //     ...dataBook.book,
        //     bookUrl: bookUrl,
        //     cvScrapedUrl,
        //   }
        // };

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
        //   cvNext,
        // };

        const bookRes = await this.prismaService.book.create({
          data: {
            title: title.trim(),
            next: cvNext,
            status: status,
            type: type,
            slug: textToSlug(title),
            anotherName: anotherName,
            description: null,
            scrapedUrl: cvScrapedUrl,
            postedBy: {
              connect: {
                userId: userId,
              },
            },
          },
        });

        console.log('Thumbnail crawl: ', thumbnail);
        // Upload Thumbnail Novel
        const dataThumbnail = await this.cloudImage.uploadImageBookOnS3({
          url: thumbnail.trim(),
          bookId: bookRes?.bookId,
        });
        console.log('Thumbnail create: ', dataThumbnail?.imageKey);

        // Update Thumbnail, Tag And Author Book
        await this.prismaService.book.update({
          where: {
            bookId: bookRes?.bookId,
          },
          data: {
            thumbnail: dataThumbnail?.imageKey,
            // author: {
            //   connectOrCreate: {
            //     where: {
            //       name: author,
            //     },
            //     create: {
            //       name: author,
            //     },
            //   },
            // },
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
            bookId: bookRes?.bookId,
            title: title,
            anotherName: anotherName,
            author: author,
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

      // if (bookRes?.chapters.length > 0 && !bookRes?.chapters[0].next) {
      //   const dataChapter = await this.crawlChapter(
      //     type,
      //     bookRes?.chapters.length > 1
      //       ? domain + '/' + bookRes?.chapters[1].next
      //       : domain + '/' + bookRes?.next,
      //   );

      //   if (dataChapter?.success && !dataChapter?.next) {
      //     return {
      //       success: false,
      //       error: 'Currently at the latest chapter.',
      //     };
      //   }
      //   bookRes.chapters[0].next = dataChapter?.next.replace(domain + '/', '');
      // }


      const listUrlChapter = await this.crawlListChapter({
        take: take,
        type: type,
        urlBook: bookUrl,
        urlCurrent:
          bookRes.chapters.length > 0 ? bookRes.chapters[0].next : bookRes.next,
      });
      // return {
      //   success: true,
      //   next: bookRes.next,
      //   bookRes,
      //   listUrlChapter: listUrlChapter,
      // };
      console.log("listUrlChapter: ", listUrlChapter);

      // Create Multiple Chapter
      const chapterRes = await this.createMultipleChaptersBook({
        type: type,
        take: +take,
        bookId: bookRes?.bookId,
        start: bookRes?._count.chapters,
        domain: domain,
        listUrlChapter: listUrlChapter.chapters,
        // chapterUrl:
        //   bookRes?._count.chapters > 0
        //     ? bookRes?.chapters[0].next
        //     : bookRes?.next,
      });
      if (!chapterRes?.success) {
        return {
          success: false,
          error: 'Crawl error.',
        };
      }
      console.log("END-----------------")

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
    listUrlChapter,
    bookId,
    // chapterUrl,
  }: {
    take: number;
    start: number;
    bookId: number;
    domain: string;
    listUrlChapter: string[];
    // chapterUrl: string;
    type: 'nettruyen' | 'manhuavn' | 'truyenqq';
  }) {
    let listChapter = [];
    // let urlQuery = listChapter[0];

    try {
      for (let i = start + 1; i <= start + take; i++) {
        const dataChapter = await this.crawlChapter(
          type,
          domain + "/" + listUrlChapter[i - start - 1],
        );
        if (!dataChapter?.success) {
          throw new Error(`Error crawling chapter ${i}: ${dataChapter?.error}`);
        }

        // return {
        //   success: true,
        //   // chapterUrl,
        //   next: listUrlChapter[i - start],
        //   dataChapter,
        //   // cvNext,
        //   // domain: domain + '/' + urlQuery,
        // };

        const imagesChapter = await this.cloudImage.uploadImagesChapterOnS3({
          bookId: bookId,
          domain: domain,
          chapterNumber: i,
          listUrl: dataChapter?.chapter.content,
        });

        if (!imagesChapter?.success || imagesChapter?.images.length === 0) {
          await this.cloudImage.deleteFolder(`truyenkk/books/${bookId}/chapters/${i}`);

          throw new Error(
            `Failed to create images for chapter ${i}: ${imagesChapter?.error}`,
          );
        }

        // Push Array Create Books
        const cvNext = listUrlChapter[i - start];
        listChapter.push({
          next: cvNext,
          bookId: bookId,
          chapterNumber: i,
          title: dataChapter?.chapter.title.trim(),
          content: JSON.stringify(imagesChapter?.images),
        });

        console.log("cvNext: ", cvNext)

        // If the next chapter doesn't exist
        if (!cvNext) {
          break;
        }

        // urlQuery = listChapter[i - start + 1];
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
  async crawlBook(type: 'nettruyen' | 'manhuavn' | 'truyenqq', url: string) {
    const baseUrl = new URL(url).origin;
    try {
      const response = await axios.get(
        'https://webcache.googleusercontent.com/search?q=cache:' + url,
        {
          headers: {
            referer: baseUrl,
            'Sec-Ch-Ua':
              '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': 'Windows',
            'User-Agent': userAgent?.getRandom(),
          },
        },
      );

      const $ = cheerio.load(response?.data, { decodeEntities: false });
      let title = '';
      let thumbnail = null;
      let description = '';
      let anotherName = '';
      let status = 1;
      let author = '';
      let tags = [];
      let next = null;

      if (type === 'nettruyen') {
        title = $('.title-detail').text().trim();

        const getAnotherName = $('.other-name').text().trim();
        anotherName =
          getAnotherName === 'Đang cập nhật' ? null : getAnotherName;
        console.log(getAnotherName);

        thumbnail = $('.col-image img').attr('src').replace('//', '').trim();

        const getAuthor = $('.author.row p').last().text();
        author = getAuthor === 'Đang cập nhật' ? null : getAuthor;

        $('.kind.row .col-xs-8 a').each((index, element) => {
          const tag = $(element)
            .attr('href')
            .trim()
            .replace(baseUrl + '/tim-truyen/', '');
          console.log(tag);
          if (tag in listIdToData) {
            tags.push(tag);
          }
        });

        next = $('.read-action a').first().attr('href');
      } else if ('manhuavn') {
        title = $('.wrap-content-info .title').text().trim();
        anotherName = $('.wrap-content-info .list-info .info-row')
          .eq(5)
          .text()
          .replace('Tác Giả :', '')
          .trim();
      } else if ('truyenqq') {
        title = $('.book_other > h1').text().trim();
        // anotherName = $('.wrap-content-info .list-info .info-row').eq(5).text().replace("Tác Giả :", "").trim();
      }

      return {
        success: true,
        book: {
          title: title,
          thumbnail: 'https://' + thumbnail,
          description: description,
          anotherName: anotherName,
          status: status,
          author: author,
          tags: tags,
          next: next?.length > 0 ? next : null,
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
  async crawlChapter(type: 'nettruyen' | 'manhuavn' | 'truyenqq', url: string) {
    try {
      console.log("chapter url: ", url)
      const baseUrl = new URL(url).origin;
      const response = await axios.get(
        'https://webcache.googleusercontent.com/search?q=cache:' + url,
        {
          headers: {
            referer: baseUrl,
            'Sec-Ch-Ua':
              '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': 'Windows',
            'User-Agent': userAgent?.getRandom(),
          },
        },
      );
      const $ = cheerio.load(response.data);

      let title = '';
      let content = [];
      let next = null;

      if (type === 'nettruyen') {
        title = '';
        content = $('.reading-detail .page-chapter img')
          .map((index, element) => 'https:' + $(element).attr('src'))
          .get();

        console.log(content);
        // let nextChapter = $('a#btn-next').attr('href');
        // next =
        //   nextChapter === 'javascript:nm5213(0)'
        //     ? null
        //     : new URL(url).origin + nextChapter;
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

  // Crawl List Chapter
  async crawlListChapter({
    take,
    type,
    urlBook,
    urlCurrent,
  }: {
    take: number;
    type: 'nettruyen' | 'manhuavn' | 'truyenqq';
    urlBook: string;
    urlCurrent: string;
  }) {
    try {
      const baseUrl = new URL(urlBook).origin;
      const response = await axios.get(
        'https://webcache.googleusercontent.com/search?q=cache:' + urlBook,
        {
          headers: {
            referer: baseUrl,
            'Sec-Ch-Ua':
              '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': 'Windows',
            'User-Agent': userAgent?.getRandom(),
          },
        },
      );
      const $ = cheerio.load(response.data);

      let title = '';
      let listChapter = [];

      if (type === 'nettruyen') {
        title = '';
        const getListChapter = $('#nt_listchapter > nav .chapter > a')
          .map((index, element) => {
            const urlChapter = $(element).attr('href');
            return urlChapter.replace(baseUrl + "/", "").trim();
          })
          .get();

        const currentIndex = getListChapter.indexOf(urlCurrent);
        console.log("urlCurrent: ", urlCurrent);
        console.log("getListChapter: ", getListChapter);
        console.log("currentIndex: ", currentIndex);
        console.log("take: ", take);
        listChapter = [...getListChapter.slice(currentIndex - take, currentIndex+1)].reverse();
      }
      return {
        success: true,
        chapters: listChapter,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }
}
