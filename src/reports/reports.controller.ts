import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, OrderStatus } from '@prisma/client';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BAKER, Role.ADMIN)
@Controller('reports')
export class ReportsController {
    constructor(private reportsService: ReportsService) { }

    @Get('dashboard')
    @ApiOperation({ summary: 'Dashboard summary — Baker & Admin' })
    getDashboard() {
        return this.reportsService.getDashboard();
    }

    @Get('orders')
    @ApiOperation({ summary: 'Laporan transaksi dengan filter' })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
    getOrderReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('status') status?: OrderStatus,
    ) {
        return this.reportsService.getOrderReport({ startDate, endDate, status });
    }
}