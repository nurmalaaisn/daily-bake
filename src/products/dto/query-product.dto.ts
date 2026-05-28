import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductSortBy {
    NAME = 'name',
    PRICE = 'price',
    STOCK = 'stock',
    CREATED_AT = 'createdAt',
}

export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc',
}

export class QueryProductDto {
    @ApiPropertyOptional({ example: 'coklat' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: 'uuid-kategori' })
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @ApiPropertyOptional({ enum: ProductSortBy, default: ProductSortBy.CREATED_AT })
    @IsOptional()
    @IsEnum(ProductSortBy)
    sortBy?: ProductSortBy = ProductSortBy.CREATED_AT;

    @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder?: SortOrder = SortOrder.DESC;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 10;
}