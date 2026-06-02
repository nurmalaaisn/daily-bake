import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
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
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException(
                'Pesanan harus memiliki minimal 1 produk',
            );
        }

        if (dto.items.length > 20) {
            throw new BadRequestException(
                'Maksimal 20 produk dalam satu pesanan',
            );
        }

        const pickupDate = new Date(dto.pickupDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(pickupDate.getTime())) {
            throw new BadRequestException('Format tanggal pickup tidak valid');
        }

        if (pickupDate < today) {
            throw new BadRequestException(
                'Tanggal pickup tidak boleh di masa lalu',
            );
        }

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(dto.pickupTime)) {
            throw new BadRequestException(
                'Format waktu pickup tidak valid, gunakan format HH:MM (contoh: 14:30)',
            );
        }

        const validPaymentMethods = ['BANK_TRANSFER', 'E_WALLET', 'COD'];
        if (!validPaymentMethods.includes(dto.paymentMethod)) {
            throw new BadRequestException(
                `Metode pembayaran tidak valid. Pilihan: ${validPaymentMethods.join(', ')}`,
            );
        }

        if (!dto.recipientName || dto.recipientName.trim() === '') {
            throw new BadRequestException('Nama penerima wajib diisi');
        }

        if (!dto.recipientPhone || dto.recipientPhone.trim() === '') {
            throw new BadRequestException('Nomor HP penerima wajib diisi');
        }

        if (!dto.recipientAddress || dto.recipientAddress.trim() === '') {
            throw new BadRequestException('Alamat penerima wajib diisi');
        }

        // Cek duplikat produk dalam satu order
        const productIds = dto.items.map((i) => Number(i.productId));
        const uniqueProductIds = [...new Set(productIds)];
        if (uniqueProductIds.length !== productIds.length) {
            throw new BadRequestException(
                'Terdapat produk yang sama dalam pesanan. Gabungkan quantity produk yang sama',
            );
        }

        // Validasi semua produk
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
        });

        for (const item of dto.items) {
            const product = products.find((p) => p.id === Number(item.productId));

            if (!product) {
                throw new NotFoundException(
                    `Produk dengan id ${item.productId} tidak ditemukan`,
                );
            }

            if (!product.isAvailable) {
                throw new BadRequestException(
                    `Produk "${product.name}" sedang tidak tersedia`,
                );
            }

            if (product.stock === 0) {
                throw new BadRequestException(
                    `Produk "${product.name}" sedang habis`,
                );
            }

            if (product.stock < item.quantity) {
                throw new BadRequestException(
                    `Stok produk "${product.name}" tidak mencukupi. Stok tersedia: ${product.stock}`,
                );
            }

            if (item.quantity < 1) {
                throw new BadRequestException(
                    `Quantity produk "${product.name}" minimal 1`,
                );
            }

            if (item.quantity > 100) {
                throw new BadRequestException(
                    `Quantity produk "${product.name}" maksimal 100 per pesanan`,
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

        try {
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

            return {
                message: 'Pesanan berhasil dibuat',
                data: order,
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException
            ) throw error;
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat membuat pesanan, coba lagi',
            );
        }
    }

    async findMyOrders(customerId: number) {
        try {
            const orders = await this.prisma.order.findMany({
                where: { customerId },
                include: {
                    orderItems: { include: { product: true } },
                    statusLogs: { orderBy: { changedAt: 'asc' } },
                    reviews: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            if (orders.length === 0) {
                return { message: 'Kamu belum memiliki pesanan', data: [] };
            }

            return { total: orders.length, data: orders };
        } catch (error) {
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil data pesanan',
            );
        }
    }

    async findAll(query: QueryOrderDto) {
        const { status, startDate, endDate, page = 1, limit = 10 } = query;

        if (Number(page) < 1) {
            throw new BadRequestException('Halaman minimal 1');
        }

        if (Number(limit) < 1 || Number(limit) > 100) {
            throw new BadRequestException('Limit harus antara 1 sampai 100');
        }

        if (startDate && isNaN(new Date(startDate).getTime())) {
            throw new BadRequestException('Format startDate tidak valid');
        }

        if (endDate && isNaN(new Date(endDate).getTime())) {
            throw new BadRequestException('Format endDate tidak valid');
        }

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            throw new BadRequestException(
                'startDate tidak boleh lebih besar dari endDate',
            );
        }

        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {};

        if (status) where.status = status;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        try {
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

            if (data.length === 0) {
                return {
                    message: status
                        ? `Tidak ada pesanan dengan status ${status}`
                        : 'Belum ada pesanan masuk',
                    data: [],
                    meta: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
                };
            }

            return {
                data,
                meta: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengambil data pesanan',
            );
        }
    }

    async findOne(id: number) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID pesanan tidak valid');
        }

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

        if (!order) {
            throw new NotFoundException(`Pesanan dengan id ${id} tidak ditemukan`);
        }

        return order;
    }

    async updateStatus(
        id: number,
        changedBy: number,
        dto: UpdateOrderStatusDto,
    ) {
        if (!id || isNaN(id)) {
            throw new BadRequestException('ID pesanan tidak valid');
        }

        const order = await this.findOne(id);

        const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
            PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            CONFIRMED: [OrderStatus.BAKING, OrderStatus.CANCELLED],
            BAKING: [OrderStatus.READY],
            READY: [OrderStatus.COMPLETED],
            COMPLETED: [],
            CANCELLED: [],
        };

        if (order.status === OrderStatus.COMPLETED) {
            throw new BadRequestException(
                'Pesanan yang sudah selesai tidak bisa diubah statusnya',
            );
        }

        if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException(
                'Pesanan yang sudah dibatalkan tidak bisa diubah statusnya',
            );
        }

        if (!allowedTransitions[order.status].includes(dto.status)) {
            throw new BadRequestException(
                `Tidak bisa mengubah status dari ${order.status} ke ${dto.status}. Alur yang benar: ${allowedTransitions[order.status].join(' atau ')}`,
            );
        }

        if (
            dto.paymentStatus &&
            order.paymentStatus === 'PAID' &&
            dto.paymentStatus !== 'PAID'
        ) {
            throw new BadRequestException(
                'Status pembayaran yang sudah PAID tidak bisa diubah',
            );
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                const updateData: any = { status: dto.status };
                if (dto.paymentStatus) updateData.paymentStatus = dto.paymentStatus;

                const updated = await tx.order.update({
                    where: { id },
                    data: updateData,
                });

                await tx.orderStatusLog.create({
                    data: { orderId: id, changedBy, status: dto.status },
                });

                return {
                    message: `Status pesanan berhasil diubah menjadi ${dto.status}`,
                    data: updated,
                };
            });
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat mengubah status pesanan',
            );
        }
    }
}