import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
    constructor(private prisma: PrismaService) { }

    async create(customerId: string, dto: CreateReviewDto) {
        // Validasi order milik customer dan sudah COMPLETED
        const order = await this.prisma.order.findFirst({
            where: {
                id: dto.orderId,
                customerId,
                status: OrderStatus.COMPLETED,
            },
            include: {
                orderItems: true,
            },
        });

        if (!order) {
            throw new NotFoundException(
                'Order tidak ditemukan atau belum selesai',
            );
        }

        // Validasi produk ada di dalam order
        const itemExists = order.orderItems.some(
            (item) => item.productId === dto.productId,
        );
        if (!itemExists) {
            throw new BadRequestException('Produk tidak ada dalam order ini');
        }

        // Cek apakah sudah pernah review produk yang sama di order yang sama
        const existing = await this.prisma.review.findUnique({
            where: {
                orderId_productId: {
                    orderId: dto.orderId,
                    productId: dto.productId,
                },
            },
        });
        if (existing) {
            throw new ConflictException('Produk ini sudah pernah direview');
        }

        return this.prisma.review.create({
            data: {
                orderId: dto.orderId,
                customerId,
                productId: dto.productId,
                rating: dto.rating,
                comment: dto.comment,
            },
            include: {
                customer: { select: { id: true, name: true } },
                product: { select: { id: true, name: true } },
            },
        });
    }

    async findAll(query: QueryReviewDto) {
        const { productId, customerId, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (productId) where.productId = productId;
        if (customerId) where.customerId = customerId;

        const [data, total] = await Promise.all([
            this.prisma.review.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true } },
                    product: { select: { id: true, name: true } },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.review.count({ where }),
        ]);

        // Hitung rata-rata rating kalau filter by product
        let averageRating: number | null = null;
        if (productId) {
            const agg = await this.prisma.review.aggregate({
                where: { productId },
                _avg: { rating: true },
                _count: { rating: true },
            });
            averageRating = agg._avg.rating
                ? Number(agg._avg.rating.toFixed(1))
                : null;
        }

        return {
            data,
            averageRating,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    async findOne(id: string) {
        const review = await this.prisma.review.findUnique({
            where: { id },
            include: {
                customer: { select: { id: true, name: true } },
                product: { select: { id: true, name: true } },
            },
        });
        if (!review) throw new NotFoundException('Review tidak ditemukan');
        return review;
    }

    async remove(id: string, customerId: string, role: string) {
        const review = await this.findOne(id);

        // Hanya pemilik review atau admin yang bisa hapus
        if (review.customerId !== customerId && role !== 'ADMIN') {
            throw new BadRequestException('Tidak punya akses untuk menghapus review ini');
        }

        await this.prisma.review.delete({ where: { id } });
        return { message: 'Review berhasil dihapus' };
    }
}