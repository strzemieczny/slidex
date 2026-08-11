import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

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
