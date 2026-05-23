import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'Budi Santoso' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ example: 'budi@email.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'password123', minLength: 6 })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiPropertyOptional({ example: '08123456789' })
    @IsOptional()
    @IsString()
    phone?: string;
}