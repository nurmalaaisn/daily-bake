import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, Query, UseGuards,
    UseInterceptors, UploadedFile, ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
    ApiTags, ApiOperation, ApiBearerAuth,
    ApiConsumes, ApiBody,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

const storage = diskStorage({
    destination: './uploads',
    filename: (_, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `product-${unique}${extname(file.originalname)}`);
    },
});

@ApiTags('Products')
@Controller('products')
export class ProductsController {
    constructor(private productsService: ProductsService) { }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @UseInterceptors(FileInterceptor('image', { storage }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number' },
                stock: { type: 'number' },
                categoryId: { type: 'number' },
                isAvailable: { type: 'boolean' },
                image: {
                    type: 'string',
                    format: 'binary',
                },
            },
            required: ['name', 'price', 'stock', 'categoryId'],
        },
    })
    @ApiOperation({ summary: 'Buat produk baru' })
    create(
        @Body() dto: CreateProductDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const imageUrl = file ? `/uploads/${file.filename}` : undefined;
        return this.productsService.create(dto, imageUrl);
    }

    @Get()
    @ApiOperation({ summary: 'Get semua produk — public' })
    findAll(@Query() query: QueryProductDto) {
        return this.productsService.findAll(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get detail produk' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.findOne(id);
    }

    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @UseInterceptors(FileInterceptor('image', { storage }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number' },
                stock: { type: 'number' },
                categoryId: { type: 'number' },
                isAvailable: { type: 'boolean' },
                image: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @ApiOperation({ summary: 'Update produk' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateProductDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const imageUrl = file ? `/uploads/${file.filename}` : undefined;
        return this.productsService.update(id, dto, imageUrl);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Hapus produk' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.remove(id);
    }
}