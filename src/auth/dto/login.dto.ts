import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'budi@email.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsNotEmpty()
    @IsString()
    password: string;
}