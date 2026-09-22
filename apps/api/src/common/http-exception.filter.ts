import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import { AppError } from './app-error';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly log = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof ZodError) {
      status = 400;
      code = 'VALIDATION_ERROR';
      message = exception.issues.map((i) => i.message).join('; ') || 'Invalid request';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message as string) || exception.message;
      if (Array.isArray(message)) message = message.join('; ');
      if (status === 401) code = 'UNAUTHORIZED';
      else if (status === 403) code = 'FORBIDDEN';
      else if (status === 404) code = 'NOT_FOUND';
      else if (status === 429) code = 'RATE_LIMITED';
      else code = 'HTTP_ERROR';
    } else {
      this.log.error(exception instanceof Error ? exception.message : 'Unhandled error');
      if (exception && typeof exception === 'object' && 'code' in exception) {
        message = 'Something went wrong';
      }
    }

    res.status(status).json({ success: false, error: { code, message } });
  }
}
