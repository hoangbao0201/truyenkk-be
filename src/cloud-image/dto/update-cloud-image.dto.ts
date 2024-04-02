import { PartialType } from '@nestjs/mapped-types';
import { CreateCloudImageDto } from './create-cloud-image.dto';

export class UpdateCloudImageDto extends PartialType(CreateCloudImageDto) {}
