import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? (body as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : 'Error interno';

    const bodyWithMessage = body as { message?: unknown };
    const errors =
      typeof body === 'object' && body !== null && Array.isArray(bodyWithMessage.message)
        ? (bodyWithMessage.message as string[])
        : undefined;

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Error desconocido',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // En producción un 5xx no expone su mensaje (puede traer SQL, rutas o detalles de Prisma): queda en el log.
    const hide = status >= 500 && process.env['NODE_ENV'] === 'production';

    response.status(status).json({
      success:    false,
      statusCode: status,
      message:    hide ? 'Error interno del servidor' : message,
      ...(errors && { errors }),
      timestamp: new Date().toISOString(),
      path:      request.url,
    });
  }
}
