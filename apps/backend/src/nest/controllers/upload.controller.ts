import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// uploads/ klasörü yoksa oluştur
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  @Post('image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Sadece görsel dosyası yüklenebilir'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  uploadImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Dosya bulunamadı');

    // Backend base URL — üretimde env'den alınmalı
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/${file.filename}`;

    return { url, filename: file.filename, size: file.size };
  }
}
