import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProductDto {
    @ApiPropertyOptional({ example: 'coklat' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: 'uuid-kategori' })
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 10;
}