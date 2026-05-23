import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
    constructor(private categoriesService: CategoriesService) { }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Buat kategori baru' })
    create(@Body() dto: CreateCategoryDto) {
        return this.categoriesService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get semua kategori — public' })
    findAll() {
        return this.categoriesService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get detail kategori' })
    findOne(@Param('id') id: string) {
        return this.categoriesService.findOne(id);
    }

    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Update kategori' })
    update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
        return this.categoriesService.update(id, dto);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Hapus kategori' })
    remove(@Param('id') id: string) {
        return this.categoriesService.remove(id);
    }
}