import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { prisma } from '../../infrastructure/database/prisma';
import { RedisCache } from '../../infrastructure/cache/RedisCache';
import { isRedisDisabled } from '../../config/redis';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { ok: true, service: 'dal' };
  }

  @Public()
  @Get('health/redis')
  async redisHealth() {
    if (isRedisDisabled()) {
      return { ok: true, redis: false, disabled: true };
    }

    const cache = new RedisCache();
    try {
      const pong = await cache.ping();
      const ok = pong === 'PONG';
      if (!ok) {
        throw new Error(`Unexpected PING response: ${pong}`);
      }
      return { ok: true, redis: true };
    } catch (e: any) {
      const message = e?.message || 'Redis health check failed';
      // eslint-disable-next-line no-console
      console.error('Redis health check error', message);
      throw new HttpException(
        {
          error: {
            code: 'REDIS_UNAVAILABLE',
            message,
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      await cache.disconnect().catch(() => undefined);
    }
  }

  @Public()
  @Get('health/db')
  async dbHealth() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch (e: any) {
      const message = e?.message || 'DB health check failed';
      // Prisma hatası ise code bilgisini maskelemeden ama host'u göstermeden loglayalım
      // eslint-disable-next-line no-console
      console.error('DB health check error', {
        code: (e as any)?.code,
        message,
      });
      throw new HttpException(
        {
          error: {
            code: 'DB_UNAVAILABLE',
            message,
            details: { prismaCode: (e as any)?.code ?? null },
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Public()
  @Get('ready')
  async ready() {
    const checks: { db: boolean; redis: boolean | 'disabled' } = {
      db: false,
      redis: isRedisDisabled() ? 'disabled' : false,
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
        const pong = await cache.ping();
        checks.redis = pong === 'PONG';
        await cache.disconnect().catch(() => undefined);
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

