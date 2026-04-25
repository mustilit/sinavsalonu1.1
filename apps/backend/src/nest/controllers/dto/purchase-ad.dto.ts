/** Reklam satın alma isteği DTO'su — paket ve test UUID'si zorunludur */
import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseAdDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  @IsUUID()
  adPackageId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsString()
  @IsUUID()
  testId!: string;
}
