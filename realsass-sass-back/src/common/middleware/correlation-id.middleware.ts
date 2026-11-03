import { Injectable, type NestMiddleware } from '@nestjs/common';
import { headerOf } from '@real/auth-server';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * CorrelationIdMiddleware — OBS-W-03/07
 * Asegura que cada request tenga X-Request-Id.
 * Si el cliente no lo envía, se genera uno.
 * Se propaga en la respuesta para que el cliente pueda correlacionar.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = headerOf(req, 'x-request-id') ?? randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
