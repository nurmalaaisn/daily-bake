import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }

    // ... method getDashboard() tetap sama seperti sebelumnya ...
    async getDashboard() {
        // [Kode getDashboard tidak diubah]
    }

    async getOrderReport(query: {
        startDate?: string;
        endDate?: string;
        status?: OrderStatus;
    }) {
        if (query.startDate && isNaN(new Date(query.startDate).getTime())) {
            throw new BadRequestException('Format startDate tidak valid');
        }

        if (query.endDate && isNaN(new Date(query.endDate).getTime())) {
            throw new BadRequestException('Format endDate tidak valid');
        }

        if (
            query.startDate &&
            query.endDate &&
            new Date(query.startDate) > new Date(query.endDate)
        ) {
            throw new BadRequestException(
                'startDate tidak boleh lebih besar dari endDate',
            );
        }

        const validStatuses = [
            'PENDING', 'CONFIRMED', 'BAKING',
            'READY', 'COMPLETED', 'CANCELLED',
        ];
        if (query.status && !validStatuses.includes(query.status)) {
            throw new BadRequestException(
                `Status tidak valid. Pilihan: ${validStatuses.join(', ')}`,
            );
        }

        try {
            const where: any = {};
            if (query.status) where.status = query.status;
            if (query.startDate || query.endDate) {
                where.createdAt = {};
                if (query.startDate) where.createdAt.gte = new Date(query.startDate);
                if (query.endDate) where.createdAt.lte = new Date(query.endDate);
            }

            // Ambil data orders beserta relasinya
            const orders = await this.prisma.order.findMany({
                where,
                include: {
                    customer: { select: { name: true, email: true } },
                    orderItems: { include: { product: { select: { name: true } } } },
                },
                orderBy: { createdAt: 'desc' },
            });

            if (orders.length === 0) {
                return {
                    message: query.status
                        ? `Tidak ada laporan untuk status ${query.status}`
                        : 'Tidak ada data pesanan pada periode ini',
                    totalOrders: 0,
                    totalRevenue: 0,
                    totalItemsSold: 0, // Ditambahkan agar frontend aman dari null/0
                    orders: [],
                };
            }

            // 1. Hitung total revenue (Hanya dari orderan yang COMPLETED)
            const totalRevenue = orders
                .filter((o) => o.status === OrderStatus.COMPLETED)
                .reduce((sum, o) => sum + Number(o.totalPrice), 0);

            // 2. LOGIKA BARU: Hitung total pcs kue yang terjual
            // Catatan: Sesuai standar report, pesanan CANCELLED tidak dihitung sebagai barang terjual
            const totalItemsSold = orders
                .filter((o) => o.status !== OrderStatus.CANCELLED)
                .reduce((sum, order) => {
                    const itemsCount = order.orderItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
                    return sum + itemsCount;
                }, 0);

            return {
                totalOrders: orders.length,
                totalRevenue,
                totalItemsSold, // <--- Sekarang properti ini terkirim di root JSON!
                orders,
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil laporan transaksi',
            );
        }
    }
}