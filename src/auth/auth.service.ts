import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
        private config: ConfigService,
    ) { }

    async register(dto: RegisterDto) {
        if (!dto.email || !dto.password || !dto.name) {
            throw new BadRequestException('Nama, email, dan password wajib diisi');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(dto.email)) {
            throw new BadRequestException('Format email tidak valid');
        }

        if (dto.password.length < 6) {
            throw new BadRequestException('Password minimal 6 karakter');
        }

        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existing) {
            throw new ConflictException('Email sudah terdaftar, gunakan email lain');
        }

        try {
            const hashed = await bcrypt.hash(dto.password, 10);
            const user = await this.prisma.user.create({
                data: { ...dto, password: hashed },
            });

            const tokens = await this.generateTokens(user.id, user.email, user.role);
            await this.saveRefreshToken(user.id, tokens.refreshToken);
            return {
                message: 'Registrasi berhasil',
                ...tokens,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat registrasi, coba lagi',
            );
        }
    }

    async login(dto: LoginDto) {
    if (!dto.email || !dto.password) {
        throw new BadRequestException('Email dan password wajib diisi');
    }

    const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
    });

    if (!user) {
        throw new UnauthorizedException(
            'Email tidak terdaftar, silakan register terlebih dahulu',
        );
    }

    const valid = await bcrypt.compare(dto.password, user.password);

    if (!valid) {
        throw new UnauthorizedException(
            'Password salah, periksa kembali password kamu',
        );
    }

    const tokens = await this.generateTokens(
        user.id,
        user.email,
        user.role,
    );

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
        message: 'Login berhasil',
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
        ...tokens,
    };
}
    async refresh(userId: number, refreshToken: string) {
        if (!refreshToken) {
            throw new BadRequestException('Refresh token wajib diisi');
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new ForbiddenException('User tidak ditemukan, silakan login ulang');
        }

        if (!user.refreshToken) {
            throw new ForbiddenException(
                'Sesi sudah berakhir, silakan login ulang',
            );
        }

        const match = await bcrypt.compare(refreshToken, user.refreshToken);
        if (!match) {
            throw new ForbiddenException(
                'Refresh token tidak valid, silakan login ulang',
            );
        }

        try {
            const tokens = await this.generateTokens(user.id, user.email, user.role);
            await this.saveRefreshToken(user.id, tokens.refreshToken);
            return {
                message: 'Token berhasil diperbarui',
                ...tokens,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat memperbarui token, coba lagi',
            );
        }
    }

    async logout(userId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException('User tidak ditemukan');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });
        return { message: 'Logout berhasil' };
    }

    private async generateTokens(userId: number, email: string, role: string) {
        const payload = { sub: userId, email, role };
        try {
            const [accessToken, refreshToken] = await Promise.all([
                this.jwt.signAsync(payload, {
                    secret: this.config.get('JWT_SECRET'),
                    expiresIn: this.config.get('JWT_EXPIRES_IN'),
                }),
                this.jwt.signAsync(payload, {
                    secret: this.config.get('JWT_REFRESH_SECRET'),
                    expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
                }),
            ]);
            return { accessToken, refreshToken };
        } catch (error) {
            throw new InternalServerErrorException('Gagal membuat token autentikasi');
        }
    }

    private async saveRefreshToken(userId: number, token: string) {
        try {
            const hashed = await bcrypt.hash(token, 10);
            await this.prisma.user.update({
                where: { id: userId },
                data: { refreshToken: hashed },
            });
        } catch (error) {
            throw new InternalServerErrorException('Gagal menyimpan sesi login');
        }
    }
}