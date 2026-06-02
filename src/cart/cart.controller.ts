import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER) // Hanya Customer yang bisa mengelola keranjang belanja
@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) { }

    @Post()
    @ApiOperation({ summary: 'Tambah produk ke keranjang (atau tambah quantity jika sudah ada)' })
    async addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
        return await this.cartService.addToCart(req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Lihat seluruh isi keranjang belanja milik saya' })
    async getCart(@Req() req: any) {
        return await this.cartService.getCart(req.user.id);
    }

    @Delete('product/:productId')
    @ApiOperation({ summary: 'Hapus satu jenis produk dari keranjang' })
    async removeCartItem(@Req() req: any, @Param('productId', ParseIntPipe) productId: number) {
        return await this.cartService.removeCartItem(req.user.id, productId);
    }

    @Delete('clear')
    @ApiOperation({ summary: 'Kosongkan seluruh isi keranjang belanja' })
    async clearCart(@Req() req: any) {
        return await this.cartService.clearCart(req.user.id);
    }
}