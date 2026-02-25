import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { PrismaAuditLogRepository } from '../../../infrastructure/repositories/PrismaAuditLogRepository';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message: string | string[] = 'Internal server error';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
        code = 'ERROR';
      } else if (resp && typeof resp === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = resp as any;
        // support both { code, message, details } and Nest's { statusCode, message, error }
        code = r.code ?? (r.error ? String(r.error).toUpperCase().replace(/\s+/g, '_') : code);
        message = r.message ?? r.error ?? message;
        details = r.details ?? r;
      }
    } else if (exception && typeof exception === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = exception as any;
      if (e.message) message = e.message;
      details = e;
    } else if (typeof exception === 'string') {
      message = exception;
      code = 'UNKNOWN';
    }

    const payload = {
      error: {
        code,
        message,
        details,
      },
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    // If this was a throttling event, record an audit log for suspicious activity
    try {
      if (exception instanceof ThrottlerException || (status === 429)) {
        const auditRepo = new PrismaAuditLogRepository();
        const xff = req.headers?.['x-forwarded-for'];
        const ip = xff ? (Array.isArray(xff) ? xff[0] : String(xff).split(',')[0].trim()) : req.ip;
        // actorId may be undefined for unauthenticated requests
        const actorId = (req as any).user?.id ?? null;
        auditRepo.create({
          action: 'SUSPICIOUS_RATE_LIMIT',
          entityType: 'Throttler',
          entityId: '',
          actorId,
          metadata: { path: req.url, ip, userAgent: req.headers['user-agent'] ?? '', details: { code } },
        }).catch(() => {
          // swallow errors to not mask original response
        });
      }
    } catch (e) {
      // ignore audit errors
    }

    res.status(status).json(payload);
  }
}

