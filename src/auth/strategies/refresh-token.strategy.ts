import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(private config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
            secretOrKey: config.get<string>('JWT_REFRESH_SECRET') as string,
            passReqToCallback: true as true,
        });
    }

    validate(req: Request, payload: any) {
        const refreshToken = req.body.refreshToken;
        return { ...payload, refreshToken };
    }
}