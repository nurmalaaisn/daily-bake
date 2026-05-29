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

    async create(customerId: number, dto: CreateReviewDto) {
        const order = await this.prisma.order.findFirst({
            where: {
                id: Number(dto.orderId),
                customerId,
                status: OrderStatus.COMPLETED,
            },
            include: { orderItems: true },
        });

        if (!order) {
            throw new NotFoundException('Order tidak ditemukan atau belum selesai');
        }

        const itemExists = order.orderItems.some(
            (item) => item.productId === Number(dto.productId),
        );
        if (!itemExists) {
            throw new BadRequestException('Produk tidak ada dalam order ini');
        }

        const existing = await this.prisma.review.findUnique({
            where: {
                orderId_productId: {
                    orderId: Number(dto.orderId),
                    productId: Number(dto.productId),
                },
            },
        });
        if (existing) {
            throw new ConflictException('Produk ini sudah pernah direview');
        }

        return this.prisma.review.create({
            data: {
                orderId: Number(dto.orderId),
                customerId,
                productId: Number(dto.productId),
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
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (productId) where.productId = Number(productId);
        if (customerId) where.customerId = Number(customerId);

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
    }

    async findOne(id: number) {
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

    async remove(id: number, customerId: number, role: string) {
        const review = await this.findOne(id);

        if (review.customerId !== customerId && role !== 'ADMIN') {
            throw new BadRequestException(
                'Tidak punya akses untuk menghapus review ini',
            );
        }

        await this.prisma.review.delete({ where: { id } });
        return { message: 'Review berhasil dihapus' };
    }
}