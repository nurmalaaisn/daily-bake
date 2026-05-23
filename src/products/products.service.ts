import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateProductDto, imageUrl?: string) {
        // Cek nama produk duplikat dalam kategori yang sama
        const existing = await this.prisma.product.findFirst({
            where: {
                name: dto.name,
                categoryId: dto.categoryId,
            },
        });

        if (existing) {
            throw new ConflictException(
                'Maaf, data sudah tersedia. Produk dengan nama ini sudah ada di kategori tersebut',
            );
        }

        // Cek kategori valid
        const category = await this.prisma.category.findUnique({
            where: { id: dto.categoryId },
        });
        if (!category) {
            throw new BadRequestException('Kategori tidak ditemukan');
        }

        const product = await this.prisma.product.create({
            data: { ...dto, image: imageUrl ?? null },
            include: { category: true },
        });

        return {
            message: 'Produk berhasil ditambahkan',
            data: product,
        };
    }

    async findAll(query: QueryProductDto) {
        const { search, categoryId, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        const where: any = { isAvailable: true };
        if (search) where.name = { contains: search, mode: 'insensitive' };
        if (categoryId) where.categoryId = categoryId;

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                include: { category: true },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            data,
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
            include: { category: true },
        });

        if (!product) throw new NotFoundException('Data tidak tersedia');
        return product;
    }

    async update(id: string, dto: UpdateProductDto, imageUrl?: string) {
        // Kalau produk tidak ada / sudah dihapus
        const current = await this.findOne(id);

        // Cek nama duplikat di kategori yang sama, kecuali produk itu sendiri
        const targetCategoryId = dto.categoryId ?? current.categoryId;
        const targetName = dto.name ?? current.name;

        if (dto.name || dto.categoryId) {
            const duplicate = await this.prisma.product.findFirst({
                where: {
                    name: targetName,
                    categoryId: targetCategoryId,
                    NOT: { id },
                },
            });

            if (duplicate) {
                throw new BadRequestException(
                    'Maaf, data sudah tersedia. Produk dengan nama ini sudah ada di kategori tersebut',
                );
            }
        }

        const data: any = { ...dto };
        if (imageUrl) data.image = imageUrl;

        const updated = await this.prisma.product.update({
            where: { id },
            data,
            include: { category: true },
        });

        return {
            message: 'Data berhasil diubah',
            data: updated,
        };
    }

    async remove(id: string) {
        // Kalau sudah dihapus sebelumnya → "Data tidak tersedia"
        await this.findOne(id);
        await this.prisma.product.delete({ where: { id } });

        return { message: 'Data berhasil dihapus' };
    }
}