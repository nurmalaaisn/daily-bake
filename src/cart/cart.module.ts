import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';

@Module({
    controllers: [CartController],
    providers: [CartService],
    exports: [CartService], // Diekspor jika modul lain sewaktu-waktu membutuhkan data keranjang
})
export class CartModule { }