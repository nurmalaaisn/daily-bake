import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryReviewDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    productId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    customerId?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 10;
}