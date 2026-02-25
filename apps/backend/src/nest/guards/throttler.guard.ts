import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: ExecutionContext['switchToHttp'] extends any ? any : any) {
    // kept for type clarity, not used
    return super['generateKey'];
  }

  protected override generateKey(context: ExecutionContext): string {
    const req = context.switchToHttp().getRequest();
    // prefer authenticated user id when available
    const userId = req.user?.id;
    if (userId) return `user:${userId}`;
    // support X-Forwarded-For header for proxied clients
    const xff = req.headers?.['x-forwarded-for'];
    if (xff) {
      const ip = Array.isArray(xff) ? xff[0] : String(xff).split(',')[0].trim();
      return `ip:${ip}`;
    }
    return `ip:${req.ip}`;
  }
}

