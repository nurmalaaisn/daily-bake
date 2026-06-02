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

    async getDashboard() {
        try {
            const [
                totalOrders,
                totalCustomers,
                pendingOrders,
                confirmedOrders,
                bakingOrders,
                readyOrders,
                completedOrders,
                cancelledOrders,
                revenue,
                topProducts,
            ] = await Promise.all([
                this.prisma.order.count(),
                this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
                this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
                this.prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
                this.prisma.order.count({ where: { status: OrderStatus.BAKING } }),
                this.prisma.order.count({ where: { status: OrderStatus.READY } }),
                this.prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
                this.prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
                this.prisma.order.aggregate({
                    where: { status: OrderStatus.COMPLETED },
                    _sum: { totalPrice: true },
                }),
                this.prisma.orderItem.groupBy({
                    by: ['productId'],
                    _sum: { quantity: true },
                    orderBy: { _sum: { quantity: 'desc' } },
                    take: 5,
                }),
            ]);

            const productIds = topProducts.map((p) => p.productId);
            const products = await this.prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, price: true },
            });

            const topProductsWithDetail = topProducts.map((item) => ({
                product: products.find((p) => p.id === item.productId) ?? null,
                totalSold: item._sum.quantity ?? 0,
            }));

            return {
                totalOrders,
                totalCustomers,
                orderSummary: {
                    pending: pendingOrders,
                    confirmed: confirmedOrders,
                    baking: bakingOrders,
                    ready: readyOrders,
                    completed: completedOrders,
                    cancelled: cancelledOrders,
                },
                totalRevenue: revenue._sum.totalPrice ?? 0,
                topProducts: topProductsWithDetail,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil data dashboard',
            );
        }
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
                    orders: [],
                };
            }

            const totalRevenue = orders
                .filter((o) => o.status === OrderStatus.COMPLETED)
                .reduce((sum, o) => sum + Number(o.totalPrice), 0);

            return {
                totalOrders: orders.length,
                totalRevenue,
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