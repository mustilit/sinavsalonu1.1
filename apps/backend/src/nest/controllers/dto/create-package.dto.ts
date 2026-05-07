import { IsString, IsInt, IsOptional, MinLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePackageDto {
  @ApiProperty({ example: 'KPSS Hazırlık Paketi', description: 'Paket başlığı' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ example: 'Bu paket KPSS sınavına hazırlık testleri içerir.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5000, description: 'Fiyat (kuruş cinsinden)' })
  @IsInt()
  @Min(0)
  priceCents!: number;
}
