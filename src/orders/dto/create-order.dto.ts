import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray, IsDateString, IsInt,
    IsNotEmpty, IsOptional, IsString,
    IsUUID, Min, ValidateNested,
} from 'class-validator';

export class OrderItemDto {
    @ApiProperty({ example: 'uuid-produk' })
    @IsUUID()
    productId: string;

    @ApiProperty({ example: 2 })
    @IsInt()
    @Min(1)
    quantity: number;
}

export class CreateOrderDto {
    @ApiProperty({ example: '2026-06-10' })
    @IsDateString()
    pickupDate: string;

    @ApiProperty({ example: '15:00' })
    @IsNotEmpty()
    @IsString()
    pickupTime: string;

    @ApiPropertyOptional({ example: 'Tanpa kacang' })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ type: [OrderItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];
}