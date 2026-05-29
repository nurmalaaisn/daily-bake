import {
    Controller, Get, Post, Delete,
    Param, Body, Query, UseGuards,
    Req, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
    constructor(private reviewsService: ReviewsService) { }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER)
    @ApiOperation({ summary: 'Buat review — hanya order COMPLETED' })
    create(@Req() req: any, @Body() dto: CreateReviewDto) {
        return this.reviewsService.create(req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get semua review — public' })
    findAll(@Query() query: QueryReviewDto) {
        return this.reviewsService.findAll(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get detail review' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.reviewsService.findOne(id);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Hapus review — pemilik atau Admin' })
    remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
        return this.reviewsService.remove(id, req.user.id, req.user.role);
    }
}