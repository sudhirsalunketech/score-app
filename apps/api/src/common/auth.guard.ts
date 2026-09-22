import { CanActivate, createParamDecorator, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Errors } from './app-error';
import { PrismaService } from '../prisma/prisma.service';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type AuthUser = { id: string; email: string; role: Role; name: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (isPublic) return true;
      throw Errors.unauthorized();
    }
    try {
      const payload = this.jwt.verify<{ sub: string; email: string; role: Role; name: string }>(token);
      req.user = { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    } catch {
      if (isPublic) return true;
      throw Errors.unauthorized('Your session has expired. Please log in again.');
    }
    const row = await this.prisma.user.findUnique({
      where: { id: (req.user as AuthUser).id },
      select: { disabledAt: true },
    });
    if (!row) throw Errors.unauthorized('Your session has expired. Please log in again.');
    if (row.disabledAt) throw Errors.forbidden('This account is disabled.');
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw Errors.unauthorized();
    if (user.role === Role.SUPER_ADMIN) return true;
    if (!roles.includes(user.role)) throw Errors.forbidden();
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
  if (!user) throw Errors.unauthorized();
  return user;
});

export const OptionalUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  return (ctx.switchToHttp().getRequest().user as AuthUser | undefined) ?? null;
});
