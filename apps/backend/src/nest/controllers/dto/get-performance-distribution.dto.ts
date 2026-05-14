/** Test performans dağılımı sorgu DTO'su — belirli deneme ID'si ile filtrelenebilir */
import { IsOptional, IsString } from 'class-validator';

export class GetPerformanceDistributionDto {
  @IsOptional()
  @IsString()
  attemptId?: string;
}
