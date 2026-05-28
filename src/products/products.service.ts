import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateProductDto, imageUrl?: string) {
        return this.prisma.product.create({
            data: { ...dto, image: imageUrl ?? null },
            include: { category: true },
        });
    }

    async findAll(query: QueryProductDto) {
        const {
            search,
            categoryId,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1,
            limit = 10,
        } = query;

        const skip = (page - 1) * limit;

        const where: any = { isAvailable: true };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categoryId) where.categoryId = categoryId;

        const orderBy: any = { [sortBy]: sortOrder };

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                include: {
                    category: true,
                    _count: { select: { reviews: true } },
                },
                skip,
                take: limit,
                orderBy,
            }),
            this.prisma.product.count({ where }),
        ]);

        // Hitung rata-rata rating tiap produk
        const productIds = data.map((p) => p.id);
        const ratings = await this.prisma.review.groupBy({
            by: ['productId'],
            where: { productId: { in: productIds } },
            _avg: { rating: true },
        });

        const dataWithRating = data.map((product) => {
            const ratingData = ratings.find((r) => r.productId === product.id);
            return {
                ...product,
                averageRating: ratingData?._avg.rating
                    ? Number(ratingData._avg.rating.toFixed(1))
                    : null,
            };
        });

        return {
            data: dataWithRating,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                reviews: {
                    include: {
                        customer: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                _count: { select: { reviews: true } },
            },
        });
        if (!product) throw new NotFoundException('Produk tidak ditemukan');

        const ratingAgg = await this.prisma.review.aggregate({
            where: { productId: id },
            _avg: { rating: true },
        });

        return {
            ...product,
            averageRating: ratingAgg._avg.rating
                ? Number(ratingAgg._avg.rating.toFixed(1))
                : null,
        };
    }

    async update(id: string, dto: UpdateProductDto, imageUrl?: string) {
        await this.findOne(id);
        const data: any = { ...dto };
        if (imageUrl) data.image = imageUrl;

        return this.prisma.product.update({
            where: { id },
            data,
            include: { category: true },
        });
    }

    async remove(id: string) {
        await this.findOne(id);
        await this.prisma.product.delete({ where: { id } });
        return { message: 'Produk berhasil dihapus' };
    }
}