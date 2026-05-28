import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateReviewDto {
    @ApiProperty({ example: 'uuid-order' })
    @IsUUID()
    orderId: string;

    @ApiProperty({ example: 'uuid-produk' })
    @IsUUID()
    productId: string;

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