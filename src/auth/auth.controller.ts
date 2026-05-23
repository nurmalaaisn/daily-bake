import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RefreshTokenGuard } from '../common/guards/refresh-token.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register customer baru' })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login user' })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('refresh')
    @UseGuards(RefreshTokenGuard)
    @ApiOperation({ summary: 'Refresh access token' })
    refresh(@Req() req: any, @Body() _dto: RefreshTokenDto) {
        return this.authService.refresh(req.user.sub, req.user.refreshToken);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout user' })
    logout(@Req() req: any) {
        return this.authService.logout(req.user.id);
    }
}