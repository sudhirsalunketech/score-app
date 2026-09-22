import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@crickscore/shared';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from './access.service';

export const PERMISSION_KEY = 'cs.permission';

export type PermissionMeta = {
  permission: Permission;
  matchParam?: string;
  inningsParam?: string;
  tournamentParam?: string;
};

export const RequirePermission = (permission: Permission, opts?: Omit<PermissionMeta, 'permission'>) =>
  SetMetadata(PERMISSION_KEY, { permission, ...opts } satisfies PermissionMeta);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<PermissionMeta | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;
    const req = context.switchToHttp().getRequest<{ user?: AuthUser; params: Record<string, string> }>();
    const user = req.user;
    if (!user) throw Errors.unauthorized();
    const params = req.params ?? {};
    if (meta.inningsParam && params[meta.inningsParam]) {
      await this.access.assertInnings(user, params[meta.inningsParam]!, meta.permission);
      return true;
    }
    if (meta.tournamentParam && params[meta.tournamentParam]) {
      await this.access.assertTournament(user, params[meta.tournamentParam]!, meta.permission);
      return true;
    }
    const matchId = params[meta.matchParam ?? 'id'];
    if (!matchId) throw Errors.forbidden("You don't have permission");
    await this.access.assertMatch(user, matchId, meta.permission);
    return true;
  }
}
