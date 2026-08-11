import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateRackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(1)
  totalShelves!: number;

  @IsNumber()
  @Min(1)
  totalColumns!: number;

  @IsOptional()
  @IsNumber()
  laneCapacity?: number;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class UpdateRackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalShelves?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalColumns?: number;

  @IsOptional()
  @IsNumber()
  laneCapacity?: number;

  @IsOptional()
  @IsString()
  groupId?: string | null;
}
