import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    @Type(() => Number)
    orderId: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    @Type(() => Number)
    productId: number;

    @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @ApiPropertyOptional({ example: 'Kuenya enak banget, recommended!' })
    @IsOptional()
    @IsString()
    comment?: string;
}