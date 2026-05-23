import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
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

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // Dipakai juga oleh update & delete — pesan seragam
        if (!user) throw new NotFoundException('Data tidak tersedia');
        return user;
    }

    async update(id: string, dto: UpdateUserDto) {
        // Kalau user tidak ada / sudah dihapus → "Data tidak tersedia"
        await this.findOne(id);

        // Kalau ada perubahan email, cek duplikat
        if (dto.name) {
            const existing = await this.prisma.user.findFirst({
                where: { name: dto.name, NOT: { id } },
            });
            if (existing) {
                throw new BadRequestException('Maaf, data sudah tersedia');
            }
        }

        const updated = await this.prisma.user.update({
            where: { id },
            data: { ...dto, updatedAt: new Date() },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                updatedAt: true,
            },
        });

        return {
            message: 'Data berhasil diubah',
            data: updated,
        };
    }

    async remove(id: string) {
        // Kalau sudah dihapus sebelumnya → findOne akan lempar "Data tidak tersedia"
        await this.findOne(id);
        await this.prisma.user.delete({ where: { id } });
        return { message: 'Data berhasil dihapus' };
    }
}