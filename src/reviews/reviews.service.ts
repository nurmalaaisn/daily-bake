import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
    constructor(private prisma: PrismaService) { }

    async create(customerId: number, dto: CreateReviewDto) {
        if (!dto.orderId) {
            throw new BadRequestException('orderId wajib diisi');
        }

        if (!dto.productId) {
            throw new BadRequestException('productId wajib diisi');
        }

        if (!dto.rating) {
            throw new BadRequestException('Rating wajib diisi');
        }

        if (dto.rating < 1 || dto.rating > 5) {
            throw new BadRequestException(
                'Rating harus antara 1 sampai 5',
            );
        }

        if (dto.comment && dto.comment.trim().length > 500) {
            throw new BadRequestException(
                'Komentar maksimal 500 karakter',
            );
        }

        // Cek order milik customer
        const order = await this.prisma.order.findFirst({
            where: { id: Number(dto.orderId), customerId },
            include: { orderItems: true },
        });

        if (!order) {
            throw new NotFoundException(
                `Pesanan dengan id ${dto.orderId} tidak ditemukan atau bukan milikmu`,
            );
        }

        if (order.status !== OrderStatus.COMPLETED) {
            throw new BadRequestException(
                `Pesanan belum selesai. Review hanya bisa diberikan setelah pesanan berstatus COMPLETED. Status saat ini: ${order.status}`,
            );
        }

        // Cek produk ada di order
        const itemExists = order.orderItems.some(
            (item) => item.productId === Number(dto.productId),
        );
        if (!itemExists) {
            throw new BadRequestException(
                `Produk dengan id ${dto.productId} tidak ada dalam pesanan ini`,
            );
        }

        // Cek produk masih ada
        const product = await this.prisma.product.findUnique({
            where: { id: Number(dto.productId) },
        });
        if (!product) {
            throw new NotFoundException(
                `Produk dengan id ${dto.productId} tidak ditemukan`,
            );
        }

        // Cek sudah pernah review
        const existing = await this.prisma.review.findUnique({
            where: {
                orderId_productId: {
                    orderId: Number(dto.orderId),
                    productId: Number(dto.productId),
                },
            },
        });
        if (existing) {
            throw new ConflictException(
                `Produk "${product.name}" dari pesanan ini sudah pernah kamu review`,
            );
        }

        try {
            return await this.prisma.review.create({
                data: {
                    orderId: Number(dto.orderId),
                    customerId,
                    productId: Number(dto.productId),
                    rating: dto.rating,
                    comment: dto.comment?.trim() ?? null,
                },
                include: {
                    customer: { select: { id: true, name: true } },
                    product: { select: { id: true, name: true } },
                },
            });
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ConflictException
            ) throw error;
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat membuat review',
            );
        }
    }

    async findAll(query: QueryReviewDto) {
        const { productId, customerId, page = 1, limit = 10 } = query;

        if (Number(page) < 1) {
            throw new BadRequestException('Halaman minimal 1');
        }

        if (Number(limit) < 1 || Number(limit) > 100) {
            throw new BadRequestException('Limit harus antara 1 sampai 100');
        }

        if (productId) {
            const product = await this.prisma.product.findUnique({
                where: { id: Number(productId) },
            });
            if (!product) {
                throw new NotFoundException(
                    `Produk dengan id ${productId} tidak ditemukan`,
                );
            }
        }

        if (customerId) {
            const user = await this.prisma.user.findUnique({
                where: { id: Number(customerId) },
            });
            if (!user) {
                throw new NotFoundException(
                    `User dengan id ${customerId} tidak ditemukan`,
                );
            }
        }

        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {};
        if (productId) where.productId = Number(productId);
        if (customerId) where.customerId = Number(customerId);

        try {
            const [data, total] = await Promise.all([
                this.prisma.review.findMany({
                    where,
                    include: {
                        customer: { select: { id: true, name: true } },
                        product: { select: { id: true, name: true } },
                    },
                    skip,
                    take: Number(limit),
                    orderBy: { createdAt: 'desc' },
                }),
                this.prisma.review.count({ where }),
            ]);

            let averageRating: number | null = null;
            if (productId) {
                const agg = await this.prisma.review.aggregate({
                    where: { productId: Number(productId) },
                    _avg: { rating: true },
                    _count: { rating: true },
                });
                averageRating =
                    agg._avg?.rating != null
                        ? Number(agg._avg.rating.toFixed(1))
                        : null;
            }

            if (data.length === 0) {
                return {
                    message: productId
                        ? 'Produk ini belum memiliki review'
                        : 'Belum ada review',
                    data: [],
                    averageRating: null,
                    meta: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
                };
            }

            return {
                data,
                averageRating,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException
            ) throw error;
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil data review',
            );
        }
    }

    async findOne(id: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID review tidak valid');
        }

        const review = await this.prisma.review.findUnique({
            where: { id },
            include: {
                customer: { select: { id: true, name: true } },
                product: { select: { id: true, name: true } },
            },
        });

        if (!review) {
            throw new NotFoundException(`Review dengan id ${id} tidak ditemukan`);
        }

        return review;
    }

    async remove(id: number, customerId: number, role: string) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID review tidak valid');
        }

        const review = await this.findOne(id);

        if (review.customerId !== customerId && role !== 'ADMIN') {
            throw new ForbiddenException(
                'Kamu tidak punya izin untuk menghapus review ini',
            );
        }

        try {
            await this.prisma.review.delete({ where: { id } });
            return { message: 'Review berhasil dihapus' };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat menghapus review',
            );
        }
    }
}