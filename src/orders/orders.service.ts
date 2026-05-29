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

    async create(customerId: number, dto: CreateOrderDto) {
        const productIds = dto.items.map((i) => Number(i.productId));
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds }, isAvailable: true },
        });

        if (products.length !== productIds.length) {
            throw new BadRequestException('Ada produk yang tidak tersedia');
        }

        for (const item of dto.items) {
            const product = products.find((p) => p.id === Number(item.productId));
            if (!product) throw new BadRequestException('Produk tidak ditemukan');
            if (product.stock < item.quantity) {
                throw new BadRequestException(
                    `Stok produk "${product.name}" tidak mencukupi`,
                );
            }
        }

        let totalPrice = 0;
        const orderItems = dto.items.map((item) => {
            const product = products.find((p) => p.id === Number(item.productId))!;
            const price = Number(product.price);
            const subtotal = price * item.quantity;
            totalPrice += subtotal;
            return {
                productId: Number(item.productId),
                quantity: item.quantity,
                price,
                subtotal,
            };
        });

        const orderCode = `DB-${Date.now()}`;

        const order = await this.prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    customerId,
                    orderCode,
                    pickupDate: new Date(dto.pickupDate),
                    pickupTime: dto.pickupTime,
                    totalPrice,
                    paymentMethod: dto.paymentMethod,
                    notes: dto.notes,
                    recipientName: dto.recipientName,
                    recipientPhone: dto.recipientPhone,
                    recipientAddress: dto.recipientAddress,
                    orderItems: { create: orderItems },
                },
                include: {
                    orderItems: { include: { product: true } },
                    customer: { select: { id: true, name: true, email: true } },
                },
            });

            await tx.orderStatusLog.create({
                data: {
                    orderId: newOrder.id,
                    changedBy: customerId,
                    status: OrderStatus.PENDING,
                },
            });

            for (const item of dto.items) {
                await tx.product.update({
                    where: { id: Number(item.productId) },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            return newOrder;
        });

        return order;
    }

    async findMyOrders(customerId: number) {
        return this.prisma.order.findMany({
            where: { customerId },
            include: {
                orderItems: { include: { product: true } },
                statusLogs: { orderBy: { changedAt: 'desc' } },
                reviews: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findAll(query: QueryOrderDto) {
        const { status, startDate, endDate, page = 1, limit = 10 } = query;
        const skip = (Number(page) - 1) * Number(limit);

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
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    }

    async findOne(id: number) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: { select: { id: true, name: true, email: true } },
                orderItems: { include: { product: true } },
                statusLogs: {
                    include: {
                        user: { select: { id: true, name: true, role: true } },
                    },
                    orderBy: { changedAt: 'asc' },
                },
                reviews: {
                    include: { customer: { select: { id: true, name: true } } },
                },
            },
        });
        if (!order) throw new NotFoundException('Order tidak ditemukan');
        return order;
    }

    async updateStatus(id: number, changedBy: number, dto: UpdateOrderStatusDto) {
        const order = await this.findOne(id);

        const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
            PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            CONFIRMED: [OrderStatus.BAKING, OrderStatus.CANCELLED],
            BAKING: [OrderStatus.READY],
            READY: [OrderStatus.COMPLETED],
            COMPLETED: [],
            CANCELLED: [],
        };

        if (!allowedTransitions[order.status].includes(dto.status)) {
            throw new BadRequestException(
                `Tidak bisa mengubah status dari ${order.status} ke ${dto.status}`,
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const updateData: any = { status: dto.status };
            if (dto.paymentStatus) updateData.paymentStatus = dto.paymentStatus;

            const updated = await tx.order.update({
                where: { id },
                data: updateData,
            });

            await tx.orderStatusLog.create({
                data: { orderId: id, changedBy, status: dto.status },
            });

            return updated;
        });
    }
}