import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean, IsInt, IsNotEmpty,
    IsOptional, IsString, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
    @ApiProperty({ example: 'Kue Coklat Lapis' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Kue lapis coklat dengan topping strawberry' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 150000 })
    @IsInt()
    @Min(0)
    @Type(() => Number)
    price: number;

    @ApiProperty({ example: 10 })
    @IsInt()
    @Min(0)
    @Type(() => Number)
    stock: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Type(() => Number)
    categoryId: number;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isAvailable?: boolean;
}