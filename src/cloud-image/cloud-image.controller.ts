import { CloudImageService } from './cloud-image.service';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';

@Controller('cloud-image')
export class CloudImageController {
  constructor(private readonly cloudImageService: CloudImageService) {}
}
