import {
    Controller, Get, Patch, Delete,
    Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get semua user — Admin only' })
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get detail user' })
    findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Patch(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update user' })
    update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(id, dto);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Hapus user' })
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }
}