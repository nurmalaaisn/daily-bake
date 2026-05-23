import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean, IsNotEmpty, IsNumber,
    IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
    @ApiProperty({ example: 'Kue Ulang Tahun Coklat' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Kue lapis coklat dengan topping strawberry' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 150000 })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    price: number;

    @ApiProperty({ example: 10 })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    stock: number;

    @ApiProperty({ example: 'uuid-kategori' })
    @IsUUID()
    categoryId: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isAvailable?: boolean;
}