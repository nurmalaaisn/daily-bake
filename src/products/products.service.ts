import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateProductDto, imageUrl?: string) {
        if (!dto.name?.trim()) {
            throw new BadRequestException('Nama produk wajib diisi');
        }

        if (dto.name.trim().length < 2) {
            throw new BadRequestException('Nama produk minimal 2 karakter');
        }

        if (Number(dto.price) <= 0) {
            throw new BadRequestException('Harga produk harus lebih dari 0');
        }

        if (Number(dto.stock) < 0) {
            throw new BadRequestException('Stok produk tidak boleh negatif');
        }

        const category = await this.prisma.category.findUnique({
            where: { id: Number(dto.categoryId) },
        });

        if (!category) {
            throw new NotFoundException(
                `Kategori dengan id ${dto.categoryId} tidak ditemukan`,
            );
        }

        try {
            return await this.prisma.product.create({
                data: {
                    ...dto,
                    image: imageUrl ?? null,
                },
                include: {
                    category: true,
                },
            });
        } catch {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat membuat produk',
            );
        }
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

        if (Number(page) < 1) {
            throw new BadRequestException('Halaman minimal 1');
        }

        if (Number(limit) < 1 || Number(limit) > 100) {
            throw new BadRequestException('Limit harus antara 1 sampai 100');
        }

        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {
            isAvailable: true,
        };

        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: 'insensitive',
                    },
                },
                {
                    description: {
                        contains: search,
                        mode: 'insensitive',
                    },
                },
            ];
        }

        if (categoryId) {
            const category = await this.prisma.category.findUnique({
                where: { id: Number(categoryId) },
            });

            if (!category) {
                throw new NotFoundException(
                    `Kategori dengan id ${categoryId} tidak ditemukan`,
                );
            }

            where.categoryId = Number(categoryId);
        }

        const validSortBy = ['name', 'price', 'stock', 'createdAt'];

        if (!validSortBy.includes(sortBy)) {
            throw new BadRequestException(
                `sortBy tidak valid. Pilihan: ${validSortBy.join(', ')}`,
            );
        }

        if (!['asc', 'desc'].includes(sortOrder)) {
            throw new BadRequestException(
                'sortOrder harus bernilai asc atau desc',
            );
        }

        try {
            const orderBy = {
                [sortBy]: sortOrder,
            };

            const [data, total] = await Promise.all([
                this.prisma.product.findMany({
                    where,
                    include: {
                        category: true,
                        _count: {
                            select: {
                                reviews: true,
                            },
                        },
                    },
                    skip,
                    take: Number(limit),
                    orderBy,
                }),
                this.prisma.product.count({ where }),
            ]);

            const productIds = data.map((product) => product.id);

            const ratings = await this.prisma.review.groupBy({
                by: ['productId'],
                where: {
                    productId: {
                        in: productIds,
                    },
                },
                _avg: {
                    rating: true,
                },
            });

            const dataWithRating = data.map((product) => {
                const ratingData = ratings.find(
                    (r) => r.productId === product.id,
                );

                return {
                    ...product,
                    averageRating:
                        ratingData?._avg?.rating != null
                            ? Number(ratingData._avg.rating.toFixed(1))
                            : null,
                };
            });

            return {
                data: dataWithRating,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            };
        } catch {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil data produk',
            );
        }
    }

    async findOne(id: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID produk tidak valid');
        }

        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                reviews: {
                    include: {
                        customer: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
                _count: {
                    select: {
                        reviews: true,
                    },
                },
            },
        });

        if (!product) {
            throw new NotFoundException(
                `Produk dengan id ${id} tidak ditemukan`,
            );
        }

        const ratingAgg = await this.prisma.review.aggregate({
            where: {
                productId: id,
            },
            _avg: {
                rating: true,
            },
        });

        return {
            ...product,
            averageRating:
                ratingAgg._avg?.rating != null
                    ? Number(ratingAgg._avg.rating.toFixed(1))
                    : null,
        };
    }

    async update(
        id: number,
        dto: UpdateProductDto,
        imageUrl?: string,
    ) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID produk tidak valid');
        }

        if (!dto || Object.keys(dto).length === 0) {
            throw new BadRequestException(
                'Tidak ada data yang dikirim untuk diupdate',
            );
        }

        if (
            dto.price !== undefined &&
            Number(dto.price) <= 0
        ) {
            throw new BadRequestException(
                'Harga produk harus lebih dari 0',
            );
        }

        if (
            dto.stock !== undefined &&
            Number(dto.stock) < 0
        ) {
            throw new BadRequestException(
                'Stok produk tidak boleh negatif',
            );
        }

        if (dto.categoryId !== undefined) {
            const category = await this.prisma.category.findUnique({
                where: {
                    id: Number(dto.categoryId),
                },
            });

            if (!category) {
                throw new NotFoundException(
                    `Kategori dengan id ${dto.categoryId} tidak ditemukan`,
                );
            }
        }

        await this.findOne(id);

        const data: any = {
            ...dto,
        };

        if (imageUrl) {
            data.image = imageUrl;
        }

        try {
            return await this.prisma.product.update({
                where: { id },
                data,
                include: {
                    category: true,
                },
            });
        } catch {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengupdate produk',
            );
        }
    }

    async remove(id: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID produk tidak valid');
        }

        const product = await this.findOne(id);

        const orderItemCount = await this.prisma.orderItem.count({
            where: {
                productId: id,
            },
        });

        if (orderItemCount > 0) {
            throw new BadRequestException(
                `Produk "${product.name}" tidak bisa dihapus karena sudah pernah dipesan. Ubah isAvailable menjadi false.`,
            );
        }

        try {
            await this.prisma.product.delete({
                where: { id },
            });

            return {
                message: `Produk "${product.name}" berhasil dihapus`,
            };
        } catch {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat menghapus produk',
            );
        }
    }
}