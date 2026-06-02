import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
    constructor(private prisma: PrismaService) { }

    async checkout(customerId: number, dto: CreateOrderDto) {
        // 1. Validasi Jam Operasional (08:00 - 20:00)
        const [pickupHour, pickupMinute] = dto.pickupTime.split(':').map(Number);
        if (pickupHour < 8 || pickupHour > 20 || (pickupHour === 20 && pickupMinute > 0)) {
            throw new BadRequestException('Jam pickup di luar jam operasional (08:00 - 20:00)');
        }

        // 2. Validasi Tanggal & Waktu (Tidak boleh masa lalu)
        const pickupDate = new Date(dto.pickupDate);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (isNaN(pickupDate.getTime())) {
            throw new BadRequestException('Format tanggal pickup tidak valid');
        }

        if (pickupDate < today) {
            throw new BadRequestException('Tanggal pickup tidak boleh masa lalu');
        }

        // Jika hari ini, periksa apakah jam penjemputan sudah lewat
        if (pickupDate.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            if (pickupHour < currentHour || (pickupHour === currentHour && pickupMinute < currentMinute)) {
                throw new BadRequestException('Jam pickup tidak boleh lebih kecil dari waktu sekarang');
            }
        }

        // 3. Ambil Keranjang Belanja (Cart) Customer
        const cart = await this.prisma.cart.findUnique({
            where: { userId: customerId },
            include: {
                cartItems: {
                    include: { product: true },
                },
            },
        });

        if (!cart || cart.cartItems.length === 0) {
            throw new BadRequestException('Keranjang belanja kamu masih kosong');
        }

        // 4. Proses Checkout dalam Blok Database Transaction (Aman dari Race Condition)
        try {
            const resultOrder = await this.prisma.$transaction(async (tx) => {
                let totalPrice = 0;

                // Memakai tipe data input dari struktur prisma yang valid tanpa field id otomatis
                const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];

                for (const item of cart.cartItems) {
                    // Validasi Dasar Ketersediaan Produk
                    if (!item.product.isAvailable) {
                        throw new BadRequestException(`Produk "${item.product.name}" sedang tidak tersedia`);
                    }

                    if (item.product.stock <= 0) {
                        throw new BadRequestException(`Stok produk "${item.product.name}" habis`);
                    }

                    // PERBAIKAN RAW SQL: Nama tabel asli kamu di DB PostgreSQL adalah "products" (bukan "Product")
                    const affectedRows = await tx.$executeRaw`
            UPDATE products 
            SET stock = stock - ${item.quantity} 
            WHERE id = ${item.productId} AND stock >= ${item.quantity}
          `;

                    if (affectedRows === 0) {
                        throw new BadRequestException(`Stok produk "${item.product.name}" tidak mencukupi atau baru saja berubah`);
                    }

                    const price = Number(item.product.price);
                    const subtotal = price * item.quantity;
                    totalPrice += subtotal;

                    // PERBAIKAN STRUKTUR PUSH: Hubungkan menggunakan skema relasi prisma objek product
                    orderItemsData.push({
                        quantity: item.quantity,
                        price,
                        subtotal,
                        product: {
                            connect: { id: item.productId }
                        }
                    });
                }

                // Pembuatan Kode Unik Pesanan (Format: DB-YYYYMMDD-Timestamp)
                const dateString = dto.pickupDate.replace(/-/g, '');
                const orderCode = `DB-${dateString}-${Date.now().toString().slice(-6)}`;

                // Buat data Order baru beserta OrderItems
                const newOrder = await tx.order.create({
                    data: {
                        customerId,
                        orderCode,
                        pickupDate: new Date(dto.pickupDate),
                        pickupTime: dto.pickupTime,
                        totalPrice,
                        paymentMethod: dto.paymentMethod,
                        paymentStatus: PaymentStatus.UNPAID,
                        status: OrderStatus.PENDING,
                        notes: dto.notes,
                        recipientName: dto.recipientName,
                        recipientPhone: dto.recipientPhone,
                        recipientAddress: dto.recipientAddress,
                        orderItems: {
                            create: orderItemsData,
                        },
                    },
                    include: {
                        orderItems: { include: { product: true } },
                        customer: { select: { id: true, name: true, email: true } },
                    },
                });

                // Catat Log Status Pertama (PENDING)
                await tx.orderStatusLog.create({
                    data: {
                        orderId: newOrder.id,
                        changedBy: customerId,
                        status: OrderStatus.PENDING,
                    },
                });

                // Kosongkan Keranjang Belanja Customer setelah sukses dibeli
                await tx.cartItem.deleteMany({
                    where: { cartId: cart.id },
                });

                return newOrder;
            });

            return {
                message: 'Checkout berhasil, pesanan Anda telah dibuat',
                data: resultOrder,
            };

        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat memproses checkout pesanan: ' + (error as Error).message,
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
            throw new BadRequestException('startDate tidak boleh lebih besar dari endDate');
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
            throw new BadRequestException('Pesanan yang sudah selesai tidak bisa diubah statusnya');
        }

        if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException('Pesanan yang sudah dibatalkan tidak bisa diubah statusnya');
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
            throw new BadRequestException('Status pembayaran yang sudah PAID tidak bisa diubah kembali');
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