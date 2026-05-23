import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateCategoryDto) {
        // Cek duplikat nama kategori
        const existing = await this.prisma.category.findUnique({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException('Maaf, data sudah tersedia');
        }

        const category = await this.prisma.category.create({ data: dto });

        return {
            message: 'Kategori berhasil ditambahkan',
            data: category,
        };
    }

    async findAll() {
        return this.prisma.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: { products: true },
        });

        if (!category) throw new NotFoundException('Data tidak tersedia');
        return category;
    }

    async update(id: string, dto: UpdateCategoryDto) {
        // Kalau kategori tidak ada / sudah dihapus
        await this.findOne(id);

        // Cek apakah nama baru sudah dipakai kategori lain
        if (dto.name) {
            const duplicate = await this.prisma.category.findFirst({
                where: { name: dto.name, NOT: { id } },
            });

            if (duplicate) {
                throw new BadRequestException('Maaf, data sudah tersedia');
            }
        }

        const updated = await this.prisma.category.update({
            where: { id },
            data: dto,
        });

        return {
            message: 'Data berhasil diubah',
            data: updated,
        };
    }

    async remove(id: string) {
        // Kalau sudah dihapus sebelumnya → "Data tidak tersedia"
        await this.findOne(id);
        await this.prisma.category.delete({ where: { id } });

        return { message: 'Data berhasil dihapus' };
    }
}