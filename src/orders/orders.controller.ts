import {
    Controller, Get, Post, Patch,
    Param, Body, Query, UseGuards,
    Req, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
    constructor(private ordersService: OrdersService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(Role.CUSTOMER)
    @ApiOperation({ summary: 'Buat pesanan baru — Customer only' })
    create(@Req() req: any, @Body() dto: CreateOrderDto) {
        return this.ordersService.create(req.user.id, dto);
    }

    @Get('my')
    @UseGuards(RolesGuard)
    @Roles(Role.CUSTOMER)
    @ApiOperation({ summary: 'Lihat riwayat pesanan saya — Customer only' })
    findMyOrders(@Req() req: any) {
        return this.ordersService.findMyOrders(req.user.id);
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Get semua pesanan — Baker & Admin' })
    findAll(@Query() query: QueryOrderDto) {
        return this.ordersService.findAll(query);
    }

    @Get(':id')
    @UseGuards(RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Get detail pesanan' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.ordersService.findOne(id);
    }

    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Update status pesanan — Baker & Admin' })
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: any,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.ordersService.updateStatus(id, req.user.id, dto);
    }
}