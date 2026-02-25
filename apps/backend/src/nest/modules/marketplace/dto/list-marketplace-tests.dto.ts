import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListMarketplaceTestsDto {
  @IsOptional()
  @IsString()
  examTypeId!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    const v = String(value).toLowerCase();
    return v === 'true' ? true : v === 'false' ? false : undefined;
  })
  @IsBoolean()
  isTimed!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPriceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPriceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit!: number;

  @IsOptional()
  @IsString()
  sortBy!: string;

  @IsOptional()
  @IsString()
  order!: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRating?: number;
}

