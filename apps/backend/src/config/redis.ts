import { z } from 'zod';

const envSchema = z.object({
  DOCKER: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_DISABLED: z.string().optional(),
});

function isLocalhost(host?: string) {
  return host === '127.0.0.1' || host === 'localhost';
}

export function isRedisDisabled() {
  const env = envSchema.parse(process.env);
  return env.REDIS_DISABLED === '1' || env.REDIS_DISABLED === 'true';
}

export function getRedisUrl(): string {
  const env = envSchema.parse(process.env);

  if (env.REDIS_URL && env.REDIS_URL.trim().length > 0) return env.REDIS_URL;

  const port = env.REDIS_PORT ?? '6379';

  const host =
    env.REDIS_HOST ??
    (env.DOCKER === '1' ? 'redis' : '127.0.0.1');

  return `redis://${host}:${port}`;
}

export function validateRedisEnv() {
  const env = envSchema.parse(process.env);
  if (isRedisDisabled()) return;

  const url = getRedisUrl();
  const host = url.replace('redis://', '').split(':')[0];

  if (env.DOCKER === '1' && isLocalhost(host)) {
    // eslint-disable-next-line no-console
    console.error(
      `[Redis] Invalid config: DOCKER=1 but redis host is "${host}". Use "redis" service name (redis://redis:6379).`,
    );
    process.exit(1);
  }

  if (env.DOCKER !== '1' && host === 'redis') {
    // eslint-disable-next-line no-console
    console.error(
      `[Redis] Invalid config: local run but redis host is "redis". Use localhost/127.0.0.1 or set DOCKER=1.`,
    );
    process.exit(1);
  }
}



