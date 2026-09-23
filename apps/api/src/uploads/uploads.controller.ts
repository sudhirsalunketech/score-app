import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { saveUploadedImage, uploadBodySchema } from './image-upload';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  @Post()
  upload(@Body() body: unknown) {
    const input = uploadBodySchema.parse(body ?? {});
    return saveUploadedImage(input.dataUrl);
  }
}
