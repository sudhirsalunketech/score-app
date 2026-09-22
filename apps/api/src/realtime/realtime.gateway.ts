import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { LIVE_SOCKET, canJoinLiveRoom, isLinkShareable } from '@crickscore/shared';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { canViewPrivateMatch, hasActiveAccessGrant } from '../matches/scoring-access';
import type { AuthUser } from '../common/auth.guard';

@WebSocketGateway({ cors: { origin: true } })
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly log = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
    const url = process.env.REDIS_URL;
    if (!url) return;
    void import('@socket.io/redis-adapter')
      .then(async ({ createAdapter }) => {
        const RedisCtor = (await import('ioredis')).default as unknown as new (url: string) => import('ioredis').default;
        const pub = new RedisCtor(url);
        const sub = pub.duplicate();
        pub.on('error', (err: unknown) => this.log.warn(`Redis pub client error: ${String(err)}`));
        sub.on('error', (err: unknown) => this.log.warn(`Redis sub client error: ${String(err)}`));
        server.adapter(createAdapter(pub, sub));
        this.log.log('Socket.IO Redis adapter enabled');
      })
      .catch((err: unknown) => {
        this.log.warn(`Socket.IO Redis adapter not loaded: ${String(err)}`);
      });
  }

  @SubscribeMessage(LIVE_SOCKET.joinMatch)
  async join(@MessageBody() matchId: string, @ConnectedSocket() client: Socket) {
    if (!matchId || typeof matchId !== 'string') return;
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, visibility: true, publicLiveEnabled: true, createdById: true, settings: true },
    });
    if (!match) return;
    const user = this.userFromSocket(client);
    const grant = user
      ? await this.prisma.matchAccess.findUnique({
          where: { matchId_userId: { matchId: match.id, userId: user.id } },
          select: { status: true, expiresAt: true },
        })
      : null;
    if (
      !canJoinLiveRoom({
        publicLiveEnabled: match.publicLiveEnabled || isLinkShareable(match.visibility),
        authenticated: canViewPrivateMatch(user, match) || hasActiveAccessGrant(grant),
        visibility: match.visibility,
      })
    ) {
      client.emit(LIVE_SOCKET.joinDenied, { reason: 'private' });
      return;
    }
    void client.join(`match:${match.id}`);
    client.emit(LIVE_SOCKET.joined, { matchId: match.id });
  }

  @SubscribeMessage(LIVE_SOCKET.joinPublic)
  async joinPublic(@MessageBody() slug: string, @ConnectedSocket() client: Socket) {
    if (!slug || typeof slug !== 'string') return;
    const match = await this.prisma.match.findUnique({
      where: { publicSlug: slug },
      select: { id: true, publicLiveEnabled: true, visibility: true },
    });
    if (
      !match ||
      !canJoinLiveRoom({
        publicLiveEnabled: match.publicLiveEnabled,
        authenticated: false,
        visibility: match.visibility,
      })
    ) {
      client.emit(LIVE_SOCKET.joinDenied, { reason: 'private' });
      return;
    }
    void client.join(`match:${match.id}`);
    void client.join(`public-view:${match.id}`);
    client.data.publicMatchId = match.id;
    client.emit(LIVE_SOCKET.joined, { matchId: match.id });
    this.emitViewers(match.id);
  }

  handleDisconnect(client: Socket) {
    const matchId = client.data?.publicMatchId as string | undefined;
    if (matchId) this.emitViewers(matchId);
  }

  publicViewerCount(matchId: string): number {
    return this.server?.sockets.adapter.rooms.get(`public-view:${matchId}`)?.size ?? 0;
  }

  private emitViewers(matchId: string) {
    this.server?.to(`match:${matchId}`).emit(LIVE_SOCKET.viewerCount, { matchId, count: this.publicViewerCount(matchId) });
  }

  private userFromSocket(client: Socket): AuthUser | null {
    const token = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub: string; email: string; role: AuthUser['role']; name: string }>(token);
      return { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    } catch {
      return null;
    }
  }

  emitMatch(matchId: string, event: string, payload: unknown) {
    this.server?.to(`match:${matchId}`).emit(event, payload);
    if (event !== 'score.updated' && event !== LIVE_SOCKET.scoreUpdated) {
      this.server?.to(`match:${matchId}`).emit('score.updated', payload);
    }
    if (event !== LIVE_SOCKET.scoreUpdated) {
      this.server?.to(`match:${matchId}`).emit(LIVE_SOCKET.scoreUpdated, payload);
    }
  }

  emitFan(matchId: string, event: string, payload: unknown) {
    this.server?.to(`match:${matchId}`).emit(event, payload);
  }

  emitTournament(tournamentId: string, event: string, payload: unknown) {
    this.server?.to(`tournament:${tournamentId}`).emit(event, payload);
  }
}
