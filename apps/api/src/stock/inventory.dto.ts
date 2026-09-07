import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class InventoryLineDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0)
  physicalStock!: number;
}

export class InventoryDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  items!: InventoryLineDto[];
}
