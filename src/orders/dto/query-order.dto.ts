import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export class QueryOrderDto {
    @ApiPropertyOptional({ enum: OrderStatus })
    @IsOptional()
    @IsEnum(OrderStatus)
    status?: OrderStatus;

    @ApiPropertyOptional({ example: '2026-06-01' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ example: '2026-06-30' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 10;
}