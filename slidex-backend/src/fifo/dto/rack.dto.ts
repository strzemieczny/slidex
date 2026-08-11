import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsInt,
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
  @IsInt()
  @Min(1)
  laneCapacity?: number;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
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
  @IsInt()
  @Min(1)
  laneCapacity?: number;

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
