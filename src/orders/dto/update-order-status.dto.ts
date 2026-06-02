import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
    @ApiProperty({ enum: OrderStatus })
    @IsEnum(OrderStatus)
    status!: OrderStatus;

    @ApiPropertyOptional({ enum: PaymentStatus })
    @IsOptional()
    @IsEnum(PaymentStatus)
    paymentStatus?: PaymentStatus;

    @ApiPropertyOptional({ example: 'Pembayaran sudah dikonfirmasi' })
    @IsOptional()
    @IsString()
    note?: string;
}