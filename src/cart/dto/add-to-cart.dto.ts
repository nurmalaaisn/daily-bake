import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
    @ApiProperty({ example: 1, description: 'ID Produk yang ingin dimasukkan' })
    @IsInt()
    @Type(() => Number)
    productId!: number;

    @ApiProperty({ example: 1, description: 'Jumlah produk' })
    @IsInt()
    @Min(1, { message: 'Kuantitas minimal adalah 1' })
    @Max(100, { message: 'Maksimal pembelian produk ini adalah 100 per item' })
    quantity!: number;
}