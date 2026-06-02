import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateCategoryDto) {
        if (!dto.name || dto.name.trim() === '') {
            throw new BadRequestException('Nama kategori wajib diisi');
        }

        if (dto.name.trim().length < 2) {
            throw new BadRequestException('Nama kategori minimal 2 karakter');
        }

        if (dto.name.trim().length > 50) {
            throw new BadRequestException('Nama kategori maksimal 50 karakter');
        }

        const existing = await this.prisma.category.findUnique({
            where: { name: dto.name.trim() },
        });
        if (existing) {
            throw new ConflictException(
                `Kategori dengan nama "${dto.name}" sudah ada`,
            );
        }

        try {
            return await this.prisma.category.create({
                data: { name: dto.name.trim() },
            });
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat membuat kategori',
            );
        }
    }

    async findAll() {
        try {
            const categories = await this.prisma.category.findMany({
                include: { _count: { select: { products: true } } },
                orderBy: { createdAt: 'desc' },
            });

            if (categories.length === 0) {
                return { message: 'Belum ada kategori yang tersedia', data: [] };
            }

            return categories;
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil data kategori',
            );
        }
    }

    async findOne(id: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID kategori tidak valid');
        }

        const category = await this.prisma.category.findUnique({
            where: { id },
            include: { products: true },
        });

        if (!category) {
            throw new NotFoundException(`Kategori dengan id ${id} tidak ditemukan`);
        }

        return category;
    }

    async update(id: number, dto: UpdateCategoryDto) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID kategori tidak valid');
        }

        if (!dto.name || dto.name.trim() === '') {
            throw new BadRequestException('Nama kategori wajib diisi');
        }

        if (dto.name.trim().length < 2) {
            throw new BadRequestException('Nama kategori minimal 2 karakter');
        }

        if (dto.name.trim().length > 50) {
            throw new BadRequestException('Nama kategori maksimal 50 karakter');
        }

        await this.findOne(id);

        const existing = await this.prisma.category.findUnique({
            where: { name: dto.name.trim() },
        });
        if (existing && existing.id !== id) {
            throw new ConflictException(
                `Kategori dengan nama "${dto.name}" sudah ada`,
            );
        }

        try {
            return await this.prisma.category.update({
                where: { id },
                data: { name: dto.name.trim() },
            });
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengupdate kategori',
            );
        }
    }

    async remove(id: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID kategori tidak valid');
        }

        const category = await this.findOne(id);

        const productCount = await this.prisma.product.count({
            where: { categoryId: id },
        });

        if (productCount > 0) {
            throw new BadRequestException(
                `Kategori "${category.name}" tidak bisa dihapus karena masih memiliki ${productCount} produk. Hapus atau pindahkan produk terlebih dahulu`,
            );
        }

        try {
            await this.prisma.category.delete({ where: { id } });
            return { message: `Kategori "${category.name}" berhasil dihapus` };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat menghapus kategori',
            );
        }
    }
}