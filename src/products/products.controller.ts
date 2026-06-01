import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiConsumes,
    ApiBody,
} from '@nestjs/swagger';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { Role } from '@prisma/client';

import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

import {
    imageFileFilter,
    maxFileSize,
} from '../common/utils/file-filter.util';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
    constructor(
        private productsService: ProductsService,
        private cloudinaryService: CloudinaryService,
    ) { }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @UseInterceptors(
        FileInterceptor('image', {
            storage: memoryStorage(),
            fileFilter: imageFileFilter,
            limits: {
                fileSize: maxFileSize,
            },
        }),
    )
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: CreateProductDto })
    @ApiOperation({ summary: 'Buat produk baru' })
    async create(
        @Body() dto: CreateProductDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        let imageUrl: string | undefined;

        if (file) {
            imageUrl = await this.cloudinaryService.uploadFile(file);
        }

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
    @UseInterceptors(
        FileInterceptor('image', {
            storage: memoryStorage(),
            fileFilter: imageFileFilter,
            limits: {
                fileSize: maxFileSize,
            },
        }),
    )
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: UpdateProductDto })
    @ApiOperation({ summary: 'Update produk' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateProductDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        let imageUrl: string | undefined;

        if (file) {
            const existing = await this.productsService.findOne(id);

            if (existing.image) {
                await this.cloudinaryService.deleteFile(existing.image);
            }

            imageUrl = await this.cloudinaryService.uploadFile(file);
        }

        return this.productsService.update(id, dto, imageUrl);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BAKER, Role.ADMIN)
    @ApiOperation({ summary: 'Hapus produk' })
    async remove(@Param('id', ParseIntPipe) id: number) {
        const existing = await this.productsService.findOne(id);

        if (existing.image) {
            await this.cloudinaryService.deleteFile(existing.image);
        }

        return this.productsService.remove(id);
    }
}