import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class UpdateCartItemDto {
    @ApiProperty({ example: 5, description: 'Jumlah produk baru yang diperbarui (1-100)' })
    @IsInt()
    @Min(1, { message: 'Quantity minimal 1' })
    @Max(100, { message: 'Quantity maksimal 100' })
    @IsNotEmpty()
    quantity!: number;
}