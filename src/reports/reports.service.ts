import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }

    async getDashboard() {
        const [
            totalOrders,
            totalCustomers,
            pendingOrders,
            completedOrders,
            revenue,
            topProducts,
        ] = await Promise.all([
            this.prisma.order.count(),
            this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
            this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
            this.prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
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

        // Ambil detail produk terlaris
        const productIds = topProducts.map((p) => p.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, price: true },
        });

        const topProductsWithDetail = topProducts.map((item) => ({
            product: products.find((p) => p.id === item.productId),
            totalSold: item._sum.quantity,
        }));

        return {
            totalOrders,
            totalCustomers,
            pendingOrders,
            completedOrders,
            totalRevenue: revenue._sum.totalPrice ?? 0,
            topProducts: topProductsWithDetail,
        };
    }

    async getOrderReport(query: {
        startDate?: string;
        endDate?: string;
        status?: OrderStatus;
    }) {
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

        const totalRevenue = orders
            .filter((o) => o.status === OrderStatus.COMPLETED)
            .reduce((sum, o) => sum + Number(o.totalPrice), 0);

        return {
            totalOrders: orders.length,
            totalRevenue,
            orders,
        };
    }
}