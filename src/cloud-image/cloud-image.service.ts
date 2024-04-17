import axios from 'axios';
import * as sharp from 'sharp';
import userAgent from 'random-useragent';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { join } from 'path';

@Injectable()
export class CloudImageService {
  private s3_client: S3Client;
  constructor(
    private configService: ConfigService,
  ) {
    this.s3_client = new S3Client({
      region: this.configService.get('S3Region'),
      credentials: {
        accessKeyId: this.configService.get('Accesskey'),
        secretAccessKey: this.configService.get('SecretAccessKey'),
      },
    });
  }

  // Upload Image Book
  async uploadImageBookOnS3({
    url,
    bookId,
  }: {
    url: string;
    bookId: number;
  }) {
    try {
      const imageGet = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'Sec-Ch-Ua':
            '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': 'Windows',
          'User-Agent': userAgent?.getRandom(),
        },
      });

      // Process the image to limit its width
      const processedImage = await sharp(imageGet.data)
        .resize({ width: 282, height: 373, fit: 'cover', position: 'center' })
        .toBuffer();

      const key = `truyenkk/books/${bookId}/${Date.now().toString()}.jpg`;
      await this.s3_client.send(
        new PutObjectCommand({
          Bucket: 'hxclub-bucket',
          Key: key,
          ContentType: imageGet?.headers['content-type'],
          Body: processedImage,
        }),
      );
      
      return {
        success: true,
        imageKey: key,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  // Upload Images Chapter
  async uploadImagesChapterOnS3(data: {
    bookId: number,
    domain: string,
    listUrl: string[],
    chapterNumber: number,
  }) {
    const { bookId, domain, chapterNumber, listUrl = [] } = data;
    let results = [];
    let k = 0;
    try {
      for (let i = 0; i < listUrl.length; i += 20) {
        const chunkUrls = listUrl.slice(i, i + 20);
        const uploadPromises = await chunkUrls.map(async (url) => {
          // try {
            const imageGet = await axios.get(`${url}`, {
              responseType: 'arraybuffer',
              headers: {
                referer: domain,
                'Sec-Ch-Ua':
                  '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': 'Windows',
                'User-Agent': userAgent?.getRandom(),
              },
            });
  
            const key = `truyenkk/books/${bookId}/chapters/${chapterNumber}/` + k + '.jpg';
  
            k++;
            return new Promise<string>(async (resolve, reject) => {
              try {
                // Process the image to limit its width
                const processedImage = await sharp(imageGet.data)
                  .resize({ width: 1100 })
                  .toBuffer();

                // Load the logo image
                const logoPath = join(__dirname, "../..", 'assets/images', 'banner-truyenkk.png');
                const logoBuffer = await sharp(logoPath)
                  .resize({ width: 270 })
                  .toBuffer();

                const finalImageBuffer = await sharp(processedImage)
                  .composite([
                    {
                      input: logoBuffer,
                      top: 10,
                      left: 10,
                    },
                  ])
                  .toBuffer();

                await this.s3_client.send(
                  new PutObjectCommand({
                    Bucket: 'hxclub-bucket',
                    Key: key,
                    ContentType: imageGet?.headers['content-type'],
                    Body: finalImageBuffer,
                  }),
                );
                console.log("Image " + k)
                console.log(key)
                resolve(key);
              } catch (error) {
                reject(error);
              }
            });
          // } catch (error) {
          //   console.log("Lỗi image")
          //   return { success: false, error };
          // }
        });

        const chunkResults = await Promise.all(uploadPromises);
        results.push(...chunkResults);

        if(listUrl.length>30) {
          await this.wait(3000);
        }
      }
      return {
        success: true,
        images: results,
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  // Delete folder
  async deleteFolder(prefix: string) {
    try {
      const listObjectsParams = {
        Bucket: 'hxclub-bucket',
        Prefix: prefix,
      };
      const data = await this.s3_client.send(
        new ListObjectsV2Command(listObjectsParams),
      );

      // Lấy danh sách các khóa của các đối tượng trong thư mục
      const objectsToDelete = data.Contents.map((object) => ({
        Key: object.Key,
      }));

      // Nếu có đối tượng để xóa, thực hiện xóa
      if (objectsToDelete.length > 0) {
        const deleteParams = {
          Bucket: 'hxclub-bucket',
          Delete: {
            Objects: objectsToDelete,
          },
        };
        await this.s3_client.send(new DeleteObjectsCommand(deleteParams));
      }
      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error
      }
    }
  }

  wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
