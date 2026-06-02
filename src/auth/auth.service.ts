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
        if (!dto.name || !dto.email || !dto.password) {
            throw new BadRequestException(
                'Nama, email, dan password wajib diisi',
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(dto.email)) {
            throw new BadRequestException('Format email tidak valid');
        }

        if (dto.password.length < 6) {
            throw new BadRequestException(
                'Password minimal 6 karakter',
            );
        }

        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException(
                'Email sudah terdaftar, gunakan email lain',
            );
        }

        try {
            const hashedPassword = await bcrypt.hash(
                dto.password,
                10,
            );

            const user = await this.prisma.user.create({
                data: {
                    ...dto,
                    password: hashedPassword,
                },
            });

            const tokens = await this.generateTokens(
                user.id,
                user.email,
                user.role,
            );

            await this.saveRefreshToken(
                user.id,
                tokens.refreshToken,
            );

            return {
                message: 'Registrasi berhasil',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                ...tokens,
            };
        } catch {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat registrasi',
            );
        }
    }

    async login(dto: LoginDto) {
        if (!dto.email || !dto.password) {
            throw new BadRequestException(
                'Email dan password wajib diisi',
            );
        }

        const user = await this.prisma.user.findUnique({
            where: {
                email: dto.email,
            },
        });

        if (!user) {
            throw new UnauthorizedException(
                'Email tidak terdaftar',
            );
        }

        const validPassword = await bcrypt.compare(
            dto.password,
            user.password,
        );

        if (!validPassword) {
            throw new UnauthorizedException(
                'Password salah',
            );
        }

        try {
            const tokens = await this.generateTokens(
                user.id,
                user.email,
                user.role,
            );

            await this.saveRefreshToken(
                user.id,
                tokens.refreshToken,
            );

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
        } catch {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat login',
            );
        }
    }

    async refresh(
        userId: number,
        refreshToken: string,
    ) {
        if (!refreshToken) {
            throw new BadRequestException(
                'Refresh token wajib diisi',
            );
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new ForbiddenException(
                'User tidak ditemukan',
            );
        }

        if (!user.refreshToken) {
            throw new ForbiddenException(
                'Sesi sudah berakhir, silakan login ulang',
            );
        }

        const tokenMatch = await bcrypt.compare(
            refreshToken,
            user.refreshToken,
        );

        if (!tokenMatch) {
            throw new ForbiddenException(
                'Refresh token tidak valid',
            );
        }

        try {
            const tokens = await this.generateTokens(
                user.id,
                user.email,
                user.role,
            );

            await this.saveRefreshToken(
                user.id,
                tokens.refreshToken,
            );

            return {
                message: 'Token berhasil diperbarui',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                ...tokens,
            };
        } catch {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat refresh token',
            );
        }
    }

    async logout(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException(
                'User tidak ditemukan',
            );
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                refreshToken: null,
            },
        });

        return {
            message: 'Logout berhasil',
        };
    }

    private async generateTokens(
        userId: number,
        email: string,
        role: string,
    ) {
        const payload = {
            sub: userId,
            email,
            role,
        };

        try {
            const [accessToken, refreshToken] =
                await Promise.all([
                    this.jwt.signAsync(payload, {
                        secret:
                            this.config.get<string>(
                                'JWT_SECRET',
                            ) || 'jwt-secret',
                        expiresIn: '5h',
                    }),
                    this.jwt.signAsync(payload, {
                        secret:
                            this.config.get<string>(
                                'JWT_REFRESH_SECRET',
                            ) || 'jwt-refresh-secret',
                        expiresIn: '7d',
                    }),
                ]);

            return {
                accessToken,
                refreshToken,
            };
        } catch {
            throw new InternalServerErrorException(
                'Gagal membuat token autentikasi',
            );
        }
    }

    private async saveRefreshToken(
        userId: number,
        token: string,
    ) {
        try {
            const hashedToken = await bcrypt.hash(
                token,
                10,
            );

            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    refreshToken: hashedToken,
                },
            });
        } catch {
            throw new InternalServerErrorException(
                'Gagal menyimpan refresh token',
            );
        }
    }
}