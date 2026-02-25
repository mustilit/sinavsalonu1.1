import IORedis from 'ioredis';

export class RedisCache {
  private client?: IORedis.Redis;
  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.client = new IORedis(url);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const v = await this.client.get(key);
    if (!v) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 600) {
    if (!this.client) return;
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async quit() {
    if (!this.client) return;
    await this.client.quit();
  }

  async del(key: string) {
    if (!this.client) return;
    await this.client.del(key);
  }

  async delByPrefix(prefix: string): Promise<number> {
    if (!this.client) return 0;
    let cursor = '0';
    let total = 0;
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length) {
        const res = await this.client.del(...keys);
        total += res;
      }
    } while (cursor !== '0');
    return total;
  }
}

