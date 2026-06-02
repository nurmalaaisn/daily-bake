import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    ForbiddenException,
    InternalServerErrorException,
    BadRequestException,
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
        // Validasi input
        if (!dto.email || !dto.password) {
            throw new BadRequestException('Email dan password wajib diisi');
        }

        // Cek email sudah terdaftar
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        }).catch(() => {
            throw new InternalServerErrorException('Gagal memeriksa data pengguna');
        });

        if (existing) {
            throw new ConflictException('Email sudah terdaftar, gunakan email lain');
        }

        // Hash password
        const hashed = await bcrypt.hash(dto.password, 10).catch(() => {
            throw new InternalServerErrorException('Gagal memproses password');
        });

        // Buat user baru
        const user = await this.prisma.user.create({
            data: { ...dto, password: hashed },
        }).catch(() => {
            throw new InternalServerErrorException('Gagal membuat akun, coba lagi nanti');
        });

        // Generate & simpan token
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        await this.saveRefreshToken(user.id, tokens.refreshToken);

        return {
            message: 'Registrasi berhasil',
            ...tokens,
        };
    }

    async login(dto: LoginDto) {
        // Validasi input
        if (!dto.email || !dto.password) {
            throw new BadRequestException('Email dan password wajib diisi');
        }

        // Cek user ada
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        }).catch(() => {
            throw new InternalServerErrorException('Gagal mengambil data pengguna');
        });

        if (!user) {
            throw new UnauthorizedException('Email atau password salah');
        }

        // Validasi password
        const valid = await bcrypt.compare(dto.password, user.password).catch(() => {
            throw new InternalServerErrorException('Gagal memverifikasi password');
        });

        if (!valid) {
            throw new UnauthorizedException('Email atau password salah');
        }

        // Generate & simpan token
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        await this.saveRefreshToken(user.id, tokens.refreshToken);

        return {
            message: 'Login berhasil',
            ...tokens,
        };
    }

    async refresh(userId: number, refreshToken: string) {
        // Validasi input
        if (!userId || !refreshToken) {
            throw new BadRequestException('User ID dan refresh token wajib disertakan');
        }

        // Cek user & token tersimpan
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        }).catch(() => {
            throw new InternalServerErrorException('Gagal mengambil data pengguna');
        });

        if (!user) {
            throw new ForbiddenException('Pengguna tidak ditemukan');
        }

        if (!user.refreshToken) {
            throw new ForbiddenException('Sesi telah berakhir, silakan login kembali');
        }

        // Cocokkan refresh token
        const match = await bcrypt.compare(refreshToken, user.refreshToken).catch(() => {
            throw new InternalServerErrorException('Gagal memverifikasi refresh token');
        });

        if (!match) {
            throw new ForbiddenException('Refresh token tidak valid atau sudah kedaluwarsa');
        }

        // Generate & simpan token baru
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        await this.saveRefreshToken(user.id, tokens.refreshToken);

        return {
            message: 'Token berhasil diperbarui',
            ...tokens,
        };
    }

    async logout(userId: number) {
        // Validasi input
        if (!userId) {
            throw new BadRequestException('User ID wajib disertakan');
        }

        // Hapus refresh token
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        }).catch(() => {
            throw new InternalServerErrorException('Gagal melakukan logout, coba lagi nanti');
        });

        return { message: 'Logout berhasil' };
    }

    private async generateTokens(userId: number, email: string, role: string) {
        const payload = { sub: userId, email, role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.signAsync(payload, {
                secret: this.config.get('JWT_SECRET'),
                expiresIn: this.config.get('JWT_EXPIRES_IN'),
            }),
            this.jwt.signAsync(payload, {
                secret: this.config.get('JWT_REFRESH_SECRET'),
                expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
            }),
        ]).catch(() => {
            throw new InternalServerErrorException('Gagal membuat token autentikasi');
        });

        return { accessToken, refreshToken };
    }

    private async saveRefreshToken(userId: number, token: string) {
        const hashed = await bcrypt.hash(token, 10).catch(() => {
            throw new InternalServerErrorException('Gagal memproses refresh token');
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: hashed },
        }).catch(() => {
            throw new InternalServerErrorException('Gagal menyimpan refresh token');
        });
    }
}