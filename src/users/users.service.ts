import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        try {
            const users = await this.prisma.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    role: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (users.length === 0) {
                return { message: 'Belum ada user yang terdaftar', data: [] };
            }

            return { total: users.length, data: users };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil data user',
            );
        }
    }

    async findOne(id: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID user tidak valid');
        }

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

        if (!user) {
            throw new NotFoundException(`User dengan id ${id} tidak ditemukan`);
        }

        return user;
    }

    async update(id: number, dto: UpdateUserDto) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID user tidak valid');
        }

        if (!dto || Object.keys(dto).length === 0) {
            throw new BadRequestException(
                'Tidak ada data yang dikirim untuk diupdate',
            );
        }

        await this.findOne(id);

        const validRoles = ['CUSTOMER', 'BAKER', 'ADMIN'];
        if (dto.role && !validRoles.includes(dto.role)) {
            throw new BadRequestException(
                `Role tidak valid. Role yang tersedia: ${validRoles.join(', ')}`,
            );
        }

        try {
            return await this.prisma.user.update({
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
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengupdate data user',
            );
        }
    }

    async remove(id: number, requesterId: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID user tidak valid');
        }

        if (id === requesterId) {
            throw new ForbiddenException(
                'Tidak bisa menghapus akun sendiri',
            );
        }

        const user = await this.findOne(id);

        if (user.role === 'ADMIN') {
            throw new ForbiddenException('Tidak bisa menghapus akun Admin');
        }

        try {
            await this.prisma.user.delete({ where: { id } });
            return { message: `User ${user.name} berhasil dihapus` };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat menghapus user',
            );
        }
    }
}