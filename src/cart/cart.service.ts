import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Injectable()
export class CartService {
    constructor(private prisma: PrismaService) { }

    private async getOrCreateCart(userId: number) {
        let cart = await this.prisma.cart.findUnique({
            where: { userId },
        });

        if (!cart) {
            cart = await this.prisma.cart.create({
                data: { userId },
            });
        }
        return cart;
    }

    async addToCart(userId: number, dto: AddToCartDto) {
        try {
            const product = await this.prisma.product.findUnique({
                where: { id: dto.productId },
            });

            if (!product) {
                throw new NotFoundException(`Produk dengan ID ${dto.productId} tidak ditemukan`);
            }

            if (!product.isAvailable) {
                throw new BadRequestException(`Produk "${product.name}" sedang tidak tersedia`);
            }

            if (product.stock < dto.quantity) {
                throw new BadRequestException(`Stok tidak mencukupi. Stok tersedia: ${product.stock}`);
            }

            const cart = await this.getOrCreateCart(userId);

            // PERBAIKAN 1: Mengubah findUnique menjadi findFirst agar tidak mengecek objek gabungan unik Prisma
            const existingItem = await this.prisma.cartItem.findFirst({
                where: {
                    cartId: cart.id,
                    productId: dto.productId,
                },
            });

            if (existingItem) {
                const totalQuantity = existingItem.quantity + dto.quantity;
                if (product.stock < totalQuantity) {
                    throw new BadRequestException(`Total kuantitas di keranjang (${totalQuantity}) melebihi stok tersedia (${product.stock})`);
                }

                await this.prisma.cartItem.update({
                    where: { id: existingItem.id },
                    data: { quantity: totalQuantity },
                });
            } else {
                await this.prisma.cartItem.create({
                    data: {
                        cartId: cart.id,
                        productId: dto.productId,
                        quantity: dto.quantity,
                    },
                });
            }

            return { message: `Berhasil menambahkan "${product.name}" ke keranjang` };
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Gagal memasukkan produk ke keranjang: ' + (error as Error).message);
        }
    }

    async getCart(userId: number) {
        try {
            const cart = await this.prisma.cart.findUnique({
                where: { userId },
                include: {
                    cartItems: {
                        include: { product: true },
                        orderBy: { id: 'asc' },
                    },
                },
            });

            if (!cart || cart.cartItems.length === 0) {
                return {
                    message: 'Keranjang belanja kamu masih kosong',
                    data: [],
                    summary: { totalItems: 0, totalPrice: 0 }
                };
            }

            let totalItems = 0;
            let totalPrice = 0;

            const items = cart.cartItems.map((item) => {
                const price = Number(item.product.price);
                const subtotal = price * item.quantity;
                totalItems += item.quantity;
                totalPrice += subtotal;

                return {
                    cartItemId: item.id,
                    productId: item.productId,
                    productName: item.product.name,
                    image: item.product.image,
                    price,
                    quantity: item.quantity,
                    subtotal,
                    availableStock: item.product.stock,
                };
            });

            return {
                message: 'Isi keranjang belanja berhasil diambil',
                data: items,
                summary: {
                    totalItems,
                    totalPrice,
                },
            };
        } catch (error) {
            throw new InternalServerErrorException('Gagal mengambil data keranjang belanja: ' + (error as Error).message);
        }
    }

    async removeCartItem(userId: number, productId: number) {
        try {
            const cart = await this.prisma.cart.findUnique({
                where: { userId },
            });

            if (!cart) {
                throw new NotFoundException('Keranjang belanja tidak ditemukan');
            }

            // PERBAIKAN 2: Mengubah findUnique menjadi findFirst untuk menghindari error objek literal
            const item = await this.prisma.cartItem.findFirst({
                where: {
                    cartId: cart.id,
                    productId,
                },
            });

            if (!item) {
                throw new NotFoundException('Produk tidak ditemukan di dalam keranjang');
            }

            await this.prisma.cartItem.delete({
                where: { id: item.id },
            });

            return { message: 'Item berhasil dihapus dari keranjang' };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Gagal menghapus item dari keranjang: ' + (error as Error).message);
        }
    }

    async clearCart(userId: number) {
        try {
            const cart = await this.prisma.cart.findUnique({
                where: { userId },
            });

            if (!cart) {
                throw new NotFoundException('Keranjang belanja tidak ditemukan');
            }

            await this.prisma.cartItem.deleteMany({
                where: { cartId: cart.id },
            });

            return { message: 'Semua item di keranjang berhasil dikosongkan' };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Gagal mengosongkan keranjang belanja: ' + (error as Error).message);
        }
    }
}