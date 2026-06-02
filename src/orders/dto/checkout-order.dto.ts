import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsEnum,
    IsOptional,
    MaxLength,
    Matches
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CheckoutOrderDto {
    @ApiProperty({ example: '2026-06-15', description: 'Tanggal penjemputan kue (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format pickupDate harus YYYY-MM-DD' })
    pickupDate!: string;

    @ApiProperty({ example: '14:30', description: 'Jam penjemputan kue (08:00 - 20:00)' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Format pickupTime harus HH:MM' })
    pickupTime!: string;

    @ApiProperty({ enum: PaymentMethod, example: 'BANK_TRANSFER' })
    @IsNotEmpty()
    @IsEnum(PaymentMethod, { message: 'Metode pembayaran tidak valid' })
    paymentMethod!: PaymentMethod;

    @ApiProperty({ example: 'Budi Santoso', description: 'Nama penerima' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^[a-zA-Z\s]+$/, { message: 'Nama penerima hanya boleh berisi huruf dan spasi' })
    recipientName!: string;

    @ApiProperty({ example: '081234567890', description: 'Nomor telepon aktif Indonesia berawalan 08' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^08\d{8,11}$/, { message: 'Nomor telepon harus diawali 08 dan berjumlah 10-13 digit' })
    recipientPhone!: string;

    @ApiProperty({ example: 'Jl. Danau Toba No. 45, Malang', description: 'Alamat penjemputan / detail pengantaran' })
    @IsNotEmpty()
    @IsString()
    recipientAddress!: string;

    @ApiPropertyOptional({ example: 'Tolong tulis ucapan Happy Birthday di atas kuenya ya.', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Notes maksimal 500 karakter' })
    notes?: string;
}