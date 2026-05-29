import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
            },
        });
    }

    async findOne(id: number) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
            },
        });
        if (!user) throw new NotFoundException('User tidak ditemukan');
        return user;
    }

    async update(id: number, dto: UpdateUserDto) {
        await this.findOne(id);
        return this.prisma.user.update({
            where: { id },
            data: dto,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                updatedAt: true,
            },
        });
    }

    async remove(id: number) {
        await this.findOne(id);
        await this.prisma.user.delete({ where: { id } });
        return { message: 'User berhasil dihapus' };
    }
}