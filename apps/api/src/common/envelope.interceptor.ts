import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = _context.switchToHttp().getRequest<{ path?: string }>();
    if (typeof req.path === 'string' && (req.path.endsWith('/preview') || req.path.endsWith('.pdf'))) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in (data as object)) return data;
        return { success: true, data: data ?? null, message: 'Success' };
      }),
    );
  }
}
