import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService, type SessionMeta } from './auth.service';
import { Public } from '../common/auth.guard';

function sessionMeta(req: Request): SessionMeta {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : req.ip;
  return { userAgent: req.headers['user-agent'], ipAddress: ip };
}

@ApiTags('auth')
@Controller('auth')
@Public()
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  register(@Body() body: unknown, @Req() req: Request) {
    return this.auth.register(body, sessionMeta(req));
  }

  @Post('login')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  login(@Body() body: unknown, @Req() req: Request) {
    return this.auth.login(body, sessionMeta(req));
  }

  @Post('google')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  google(@Body() body: unknown, @Req() req: Request) {
    return this.auth.googleLogin(body, sessionMeta(req));
  }

  @Post('otp/request')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  requestOtp(@Body() body: unknown) {
    return this.auth.requestOtp(body);
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  verifyOtp(@Body() body: unknown, @Req() req: Request) {
    return this.auth.verifyOtp(body, sessionMeta(req));
  }

  @Post('refresh')
  refresh(@Body() body: unknown, @Req() req: Request) {
    return this.auth.refresh(body, sessionMeta(req));
  }

  @Post('logout')
  logout(@Body() body: unknown) {
    return this.auth.logout(body);
  }

  @Post('forgot-password')
  forgot(@Body() body: unknown) {
    return this.auth.forgot(body);
  }

  @Post('reset-password')
  reset(@Body() body: unknown) {
    return this.auth.reset(body);
  }
}
