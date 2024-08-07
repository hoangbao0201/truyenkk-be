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

  async getBooksLatest({ tag }: { tag: string }) {
    console.log("tag: ", tag)
    // userId: number
    const manhwavnUrl = `https://manhuavn.top/the-loai/${tag}.html`;
    const baseManhwavnUrl = new URL(manhwavnUrl).origin.replace('https://', '');
    let id = 0;

    try {
      let booksManhwavn = [];

      // 
      try {
        // Crawl 
        const responseManhwavn = await axios.get(manhwavnUrl, {
          headers: {
            referer: baseManhwavnUrl,
            'Sec-Ch-Ua':
              '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': 'Windows',
            'User-Agent': userAgent?.getRandom(),
          },
        });

        const $ManhwavnHtml = cheerio.load(responseManhwavn.data);

        $ManhwavnHtml('.lst_story .story_item').each((index, element) => {
          const title = $ManhwavnHtml(element)
            .find('.story_title')
            .text();
          const thumbnailStyle = $ManhwavnHtml(element)
            .find('.story_img')
            .attr('style');
          const thumbnailMatch =
            thumbnailStyle && thumbnailStyle.match(/url\("(.+?)"\)/);
          const thumbnail = thumbnailMatch ? thumbnailMatch[1] : null;
          const href = $ManhwavnHtml(element).find('.story_img').attr('href');

          // console.log({
          //   title: title,
          //   thumbnail: thumbnail,
          //   href: href
          // })

          if(booksManhwavn.length > 14) {
            return false;
          }
          if (title && href && thumbnail) {
            booksManhwavn.push({
              title: title.trim(),
              thumbnail: thumbnail,
              link: 'https://' + baseManhwavnUrl + href,
              type: 'manhwavn',
              bookId: ++id,
            });
          }
        });
      } catch (error) {}

      return {
        success: true,
        books: [
          ...booksManhwavn,
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

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

        await this.prismaService.infoDetailManager.update({
          where: {
            userId: userId
          },
          data: {
            countCreateBook: {
              increment: 1
            }
          }
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

      if (type !== "nettruyen" && bookRes?.chapters.length > 0 && !bookRes?.chapters[0].next) {
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
      let chapterRes = null;
      // Create Multiple Chapter
      if(type === "nettruyen") {
        chapterRes = await this.createMultipleChaptersBookTypeNettruyen({
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
      }
      else {
        chapterRes = await this.createMultipleChaptersBook({
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
      }

      console.log('============== END ==============');
      
      if (!chapterRes || !chapterRes?.success) {
        return {
          success: false,
          typeCrawl: chapterRes.typeCrawl,
          message: chapterRes?.message,
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
    type: 'nettruyen' | 'manhuavn' | 'truyenqq';
  }): Promise<{
    success: boolean;
    typeCrawl: string;
    message?: string;
    dataTest?: any;
  }> {
    let listChapter = [];
    let urlQuery = chapterUrl;

    try {
      for (let i = start + 1; i <= start + take; i++) {
        console.log('urlCrawl: ', domain + '/' + urlQuery);
        const dataChapter = await this.crawlChapter(
          type,
          domain + '/' + urlQuery,
        );
        // console.log(dataChapter)
        if (!dataChapter?.success) {
          // throw new Error(`Error crawling chapter ${i}: ${dataChapter?.error}`);
          return {
            success: false,
            typeCrawl: 'CHAPTER_FETCH_FAILURE',
            message: `Lấy chương ${i} thất bại`,
          };
        }

        // return {
        //   success: true,
        //   typeCrawl: 'CHAPTER_FETCH_DATATEST__SUCCESSFULL',
        //   dataTest: {
        //     chapterUrl,
        //     dataChapter,
        //     domain: domain + '/' + urlQuery,
        //     cvNext: dataChapter?.next
        //       ? dataChapter?.next.replace(domain + '/', '')
        //       : null
        //   }
        // };

        const imagesChapter = await this.cloudImage.uploadImagesChapterOnS3({
          bookId: bookId,
          domain: domain,
          chapterNumber: i,
          listUrl: dataChapter?.chapter.content,
        });

        if (!imagesChapter?.success || imagesChapter?.images.length === 0) {
          await this.cloudImage.deleteFolder(`books/${bookId}/chapters/${i}`);

          // throw new Error(
          //   `Failed to create images for chapter ${i}: ${imagesChapter?.error}`,
          // );
          return {
            success: false,
            typeCrawl: 'CHAPTER_IMAGE_ERROR',
            message: `Lấy ảnh của chương ${i} thất bại`,
          };
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

        if (
          listChapter.length >= 3 ||
          listChapter.length >= take ||
          (listChapter.length > 0 && !cvNext)
        ) {
          // Create Chapter Book
          const chapterRes = await this.prismaService.chapter.createMany({
            data: listChapter?.map((chapter) => chapter),
          });
          if (!chapterRes) {
            return {
              success: false,
              typeCrawl: 'CREATE_CHAPTER_FAILURE',
              message: 'Tạo chương thất bại',
            };
          }

          // Update updatedAt of Book
          await this.prismaService.book.update({
            where: { bookId: bookId },
            data: { updatedAt: new Date() },
          });

          listChapter = [];
          console.log('============== UPLOAD CHAPTER ==============');
        }

        // If the next chapter doesn't exist
        if (!cvNext) {
          break;
        }

        urlQuery = cvNext;
      }

      return {
        success: true,
        typeCrawl: 'CREATE_CHAPTER_SUCCESS',
        message: 'Tạo chương thành công',
      };
    } catch (error) {
      if (listChapter?.length > 0) {
        try {
          const chapterRes = await this.prismaService.chapter.createMany({
            data: listChapter?.map((chapter) => chapter),
          });
          if (!chapterRes) {
            return {
              success: false,
              typeCrawl: 'CREATE_CHAPTER_FAILURE',
              message: 'Tạo chương thất bại',
            };
          }

          // Update updatedAt of Book
          await this.prismaService.book.update({
            where: { bookId: bookId },
            data: { updatedAt: new Date() },
          });

          return {
            success: true,
            typeCrawl: 'CREATE_CHAPTER_SUCCESS',
            message: 'Tạo chương thành công',
          };
        } catch (remainingChaptersError) {
          return {
            success: false,
            typeCrawl: 'CREATE_CHAPTER_FAILURE',
            message: remainingChaptersError.message || 'Unknown error',
          };
        }
      }
      return {
        success: false,
        typeCrawl: 'CREATE_CHAPTER_FAILURE',
        message: error.message || 'Unknown error',
      };
    }
  }

  async createMultipleChaptersBookTypeNettruyen({
    start,
    take,
    type,
    domain,
    listUrlChapter,
    bookId,
  }: {
    take: number;
    start: number;
    bookId: number;
    domain: string;
    listUrlChapter: string[];
    type: 'nettruyen' | 'manhuavn' | 'truyenqq';
  }): Promise<{
    success: boolean;
    typeCrawl: string;
    message?: string;
    dataTest?: any;
  }> {
    let listChapter = [];

    try {
      for (let i = start + 1; i <= start + take; i++) {
        const dataChapter = await this.crawlChapter(
          type,
          listUrlChapter[i - start - 1],
        );
        if (!dataChapter?.success) {
          return {
            success: false,
            typeCrawl: 'CHAPTER_FETCH_FAILURE',
            message: `Lấy chương ${i} thất bại`,
          };
        }
        console.log(dataChapter);
        return {
          success: true,
          typeCrawl: "TEST",
          // chapterUrl,
          // next: listUrlChapter[i - start],
          // dataChapter,
          // cvNext,
          // domain: domain + '/' + urlQuery,
        };

        const imagesChapter = await this.cloudImage.uploadImagesChapterOnS3({
          bookId: bookId,
          domain: domain,
          chapterNumber: i,
          listUrl: dataChapter?.chapter.content,
        });

        if (!imagesChapter?.success || imagesChapter?.images.length === 0) {
          await this.cloudImage.deleteFolder(
            `truyenkk/books/${bookId}/chapters/${i}`,
          );

          return {
            success: false,
            typeCrawl: 'CHAPTER_IMAGE_ERROR',
            message: `Lấy ảnh của chương ${i} thất bại`,
          };
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

        if (
          listChapter.length >= 3 ||
          listChapter.length >= take ||
          (listChapter.length > 0 && !cvNext)
        ) {
          // Create Chapter Book
          const chapterRes = await this.prismaService.chapter.createMany({
            data: listChapter?.map((chapter) => chapter),
          });
          if (!chapterRes) {
            return {
              success: false,
              typeCrawl: 'CREATE_CHAPTER_FAILURE',
              message: 'Tạo chương thất bại',
            };
          }

          // Update updatedAt of Book
          await this.prismaService.book.update({
            where: { bookId: bookId },
            data: { updatedAt: new Date() },
          });

          listChapter = [];
          console.log('============== UPLOAD CHAPTER ==============');
        }

        // If the next chapter doesn't exist
        if (!cvNext) {
          break;
        }

        // urlQuery = listChapter[i - start + 1];
      }

      return {
        success: true,
        typeCrawl: 'CREATE_CHAPTER_SUCCESS',
        message: 'Tạo chương thành công',
      };
    } catch (error) {
      if (listChapter?.length > 0) {
        try {
          const chapterRes = await this.prismaService.chapter.createMany({
            data: listChapter?.map((chapter) => chapter),
          });
          if (!chapterRes) {
            return {
              success: false,
              typeCrawl: 'CREATE_CHAPTER_FAILURE',
              message: 'Tạo chương thất bại',
            };
          }

          // Update updatedAt of Book
          await this.prismaService.book.update({
            where: { bookId: bookId },
            data: { updatedAt: new Date() },
          });
          return {
            success: true,
            typeCrawl: 'CREATE_CHAPTER_SUCCESS',
            message: 'Tạo chương thành công',
          };
        } catch (remainingChaptersError) {
          return {
            success: false,
            typeCrawl: 'CREATE_CHAPTER_FAILURE',
            message: remainingChaptersError.message || 'Unknown error',
          };
        }
      }
      return {
        success: false,
        typeCrawl: 'CREATE_CHAPTER_FAILURE',
        message: error.message || 'Unknown error',
      };
    }
  }

  // Crawl Book
  async crawlBook(type: 'nettruyen' | 'manhuavn' | 'truyenqq', url: string) {
    const baseUrl = new URL(url).origin;
    console.log("baseUrl: ", baseUrl)
    try {
      const response = await axios.get(
        // 'https://webcache.googleusercontent.com/search?q=cache:' + 
        // 'https://www.google.com/amp/s/www.' +
        url
          // .replace("https://", "")
        ,
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

      const $ = cheerio.load(response?.data);
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
      }
      // MANHHUAVN
      else if (type === 'manhuavn') {
        title = $('h1.title').text().trim();
        
        author = $('.list-info .info-row i.fa-user-circle-o').next().text().trim();

        thumbnail = $('.wrap-content-image img').attr('src').trim().replace("https://", "");

        $('li.clearfix i.fa-tags').nextAll('a').each(function() {
          const tag = $(this).attr("href").replace("/the-loai/", "").replace(".html", "").trim();
          if(tag in listIdToData) {
            tags.push(tag);
          }
        });

        const isNext = $("#lst-chapter li a").last().attr("href").trim();
        next = isNext ? baseUrl + isNext : false;
      }
      // TRUYENQQ
      else if (type === 'truyenqq') {
        title = $('h1').text().trim();
        thumbnail = $('.book_avatar img').attr('src').trim();
        console.log("title: ");
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
      // console.log('chapter url: ', url);
      const baseUrl = new URL(url).origin;
      const response = await axios.get(
        // 'https://webcache.googleusercontent.com/search?q=cache:' + 
        url,
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
          .map((index, element) => 'https:' + $(element).attr('data-original'))
          .get();

        // console.log(content);
        // let nextChapter = $('a#btn-next').attr('href');
        // next =
        //   nextChapter === 'javascript:nm5213(0)'
        //     ? null
        //     : new URL(url).origin + nextChapter;
      }
      else if (type === 'manhuavn') {
        title = '';
        content = $('#lst_content .page-chapter img')
          .map((index, element) => {
            const urlChapter = $(element).attr('data-original');
            return urlChapter.trim();
          })
          .get();
        next = $('#nextchap').attr('href').replace("/","");
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
        // 'https://webcache.googleusercontent.com/search?q=cache:' +
        urlBook,
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
            return urlChapter.replace(baseUrl + '/', '').trim();
          })
          .get();

        const currentIndex = getListChapter.indexOf(urlCurrent);
        console.log('urlCurrent: ', urlCurrent);
        console.log('getListChapter: ', getListChapter);
        console.log('currentIndex: ', currentIndex);
        console.log('take: ', take);
        listChapter = [
          ...getListChapter.slice(currentIndex - take, currentIndex + 1),
        ].reverse();
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
