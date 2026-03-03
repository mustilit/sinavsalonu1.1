import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { prisma } from '../../infrastructure/database/prisma';
import { RedisCache } from '../../infrastructure/cache/RedisCache';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { ok: true, service: 'dal' };
  }

  @Public()
  @Get('ready')
  async ready() {
    const checks: { db: boolean; redis: boolean | 'disabled' } = {
      db: false,
      redis: process.env.REDIS_DISABLED === '1' ? 'disabled' : false,
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch (e) {
      checks.db = false;
    }

    if (checks.redis !== 'disabled') {
      try {
        const cache = new RedisCache();
        // Basit bir noop isteği; hata alırsak redis down kabul ederiz
        await cache.get<string>('__ready__');
        checks.redis = true;
      } catch {
        checks.redis = false;
      }
    }

    const ok = checks.db === true && (checks.redis === true || checks.redis === 'disabled');
    if (!ok) {
      throw new HttpException(
        { error: { code: 'SERVICE_UNAVAILABLE', message: 'Readiness check failed', details: checks } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { ok: true, service: 'dal', checks };
  }
}

