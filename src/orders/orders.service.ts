import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
    constructor(private prisma: PrismaService) { }

    async create(customerId: string, dto: CreateOrderDto) {
        // Validasi semua produk & stok
        const productIds = dto.items.map((i) => i.productId);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds }, isAvailable: true },
        });

        if (products.length !== productIds.length) {
            throw new BadRequestException('Ada produk yang tidak tersedia');
        }

        for (const item of dto.items) {
            const product = products.find((p) => p.id === item.productId);
            if (!product) throw new BadRequestException('Produk tidak ditemukan');
            if (product.stock < item.quantity) {
                throw new BadRequestException(
                    `Stok produk "${product.name}" tidak mencukupi`,
                );
            }
        }

        // Hitung total harga
        let totalPrice = 0;
        const orderItems = dto.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            const price = Number(product.price);
            const subtotal = price * item.quantity;
            totalPrice += subtotal;
            return {
                productId: item.productId,
                quantity: item.quantity,
                price,
                subtotal,
            };
        });

        // Generate order code
        const orderCode = `DB-${Date.now()}`;

        // Buat order dalam satu transaksi
        const order = await this.prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    customerId,
                    orderCode,
                    pickupDate: new Date(dto.pickupDate),
                    pickupTime: dto.pickupTime,
                    totalPrice,
                    notes: dto.notes,
                    orderItems: { create: orderItems },
                },
                include: {
                    orderItems: { include: { product: true } },
                    customer: { select: { id: true, name: true, email: true } },
                },
            });

            // Catat status log awal
            await tx.orderStatusLog.create({
                data: {
                    orderId: newOrder.id,
                    changedBy: customerId,
                    status: OrderStatus.PENDING,
                },
            });

            // Kurangi stok
            for (const item of dto.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            return newOrder;
        });

        return {
            message: 'Pesanan berhasil dibuat',
            data: order,
        };
    } // ← kurung tutup create yang tadinya hilang

    async findMyOrders(customerId: string) {
        return this.prisma.order.findMany({
            where: { customerId },
            include: {
                orderItems: { include: { product: true } },
                statusLogs: { orderBy: { changedAt: 'desc' } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findAll(query: QueryOrderDto) {
        const { status, startDate, endDate, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const [data, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, email: true } },
                    orderItems: { include: { product: true } },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOne(id: string) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: { select: { id: true, name: true, email: true } },
                orderItems: { include: { product: true } },
                statusLogs: {
                    include: { user: { select: { id: true, name: true, role: true } } },
                    orderBy: { changedAt: 'asc' },
                },
            },
        });

        if (!order) throw new NotFoundException('Data tidak tersedia');
        return order;
    }

    async updateStatus(id: string, changedBy: string, dto: UpdateOrderStatusDto) {
        const order = await this.findOne(id);

        // Kalau status sudah final, tidak bisa diubah lagi
        if (
            order.status === OrderStatus.COMPLETED ||
            order.status === OrderStatus.CANCELLED
        ) {
            throw new BadRequestException(
                `Order sudah berstatus ${order.status}, tidak dapat diubah lagi`,
            );
        }

        // Validasi alur status
        const allowedTransitions: Record<string, OrderStatus[]> = {
            PENDING: [OrderStatus.PROCESSED, OrderStatus.CANCELLED],
            PROCESSED: [OrderStatus.READY],
            READY: [OrderStatus.COMPLETED],
        };

        if (!allowedTransitions[order.status]?.includes(dto.status)) {
            throw new BadRequestException(
                `Tidak dapat mengubah status dari ${order.status} ke ${dto.status}`,
            );
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.order.update({
                where: { id },
                data: { status: dto.status },
            });

            await tx.orderStatusLog.create({
                data: { orderId: id, changedBy, status: dto.status },
            });

            return updatedOrder;
        });

        return {
            message: 'Data berhasil diubah',
            data: updated,
        };
    }
}