import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray, IsDateString, IsEnum, IsInt,
    IsNotEmpty, IsOptional, IsString,
    IsUUID, Min, ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

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

    @ApiProperty({ enum: PaymentMethod, example: 'BANK_TRANSFER' })
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    @ApiProperty({ example: 'Budi Santoso' })
    @IsNotEmpty()
    @IsString()
    recipientName: string;

    @ApiProperty({ example: '08123456789' })
    @IsNotEmpty()
    @IsString()
    recipientPhone: string;

    @ApiProperty({ example: 'Jl. Mawar No. 12, Malang' })
    @IsNotEmpty()
    @IsString()
    recipientAddress: string;

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