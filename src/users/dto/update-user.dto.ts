import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'Budi Santoso' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: '08123456789' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ enum: Role })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;
}