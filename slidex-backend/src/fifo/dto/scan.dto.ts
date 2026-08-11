import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ScanInDto {
  @IsString()
  @IsNotEmpty()
  laneCode!: string;

  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsString()
  @IsNotEmpty()
  partNumber!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ScanOutDto {
  @IsString()
  @IsNotEmpty()
  laneCode!: string;

  @IsString()
  @IsNotEmpty()
  barcode!: string;
}

export class AuditItemDto {
  @IsString()
  @IsNotEmpty()
  materialId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class RackAuditDto {
  @IsDateString()
  startedAt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditItemDto)
  items!: AuditItemDto[];
}
