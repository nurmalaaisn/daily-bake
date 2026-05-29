import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateCategoryDto) {
        const existing = await this.prisma.category.findUnique({
            where: { name: dto.name },
        });
        if (existing) throw new ConflictException('Nama kategori sudah ada');

        return this.prisma.category.create({ data: dto });
    }

    async findAll() {
        return this.prisma.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: number) {
        const category = await this.prisma.category.findUnique({
            where: { id },
            include: { products: true },
        });
        if (!category) throw new NotFoundException('Kategori tidak ditemukan');
        return category;
    }

    async update(id: number, dto: UpdateCategoryDto) {
        await this.findOne(id);
        return this.prisma.category.update({ where: { id }, data: dto });
    }

    async remove(id: number) {
        await this.findOne(id);
        await this.prisma.category.delete({ where: { id } });
        return { message: 'Kategori berhasil dihapus' };
    }
}