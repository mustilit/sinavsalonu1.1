import 'reflect-metadata';
import { webcrypto } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { buildCspDirectivesFromEnv } from './security/csp';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtService } from '../infrastructure/services/JwtService';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { env } from '../config/env';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { requestIdMiddleware } from '../middleware/request-id.middleware';
import { validateDatabaseUrl } from '../config/database-url';
import { validateRedisEnv } from '../config/redis';

if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}

async function bootstrap() {
  // Fail-fast: DATABASE_URL ve REDIS_URL yanlış host ile configure edilmiş mi?
  validateDatabaseUrl();
  validateRedisEnv();
  const app = await NestFactory.create(AppModule);
  // Security headers via helmet (CSP driven by env)
  const cspEnabled = process.env.CSP_ENABLED !== 'false';
  const reportOnly = process.env.CSP_REPORT_ONLY === 'true';
  app.use(
    helmet({
      contentSecurityPolicy: cspEnabled
        ? {
            useDefaults: false,
            reportOnly,
            directives: buildCspDirectivesFromEnv(),
          }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
      xssFilter: true,
      noSniff: true,
      frameguard: { action: 'deny' },
      hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  // Request context middleware (requestId + tenant)
  app.use(requestIdMiddleware);
  app.use(tenantMiddleware);

  // Global pipes and guards
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Global exception filter for consistent error format
  app.useGlobalFilters(new HttpExceptionFilter());
  // Swagger / OpenAPI - tsx ile emitDecoratorMetadata uyumsuzluğu nedeniyle devre dışı
  // Dökümantasyon için: npm run build && npm run start ile çalıştırın veya SWAGGER_ENABLED=1 deneyin
  if (process.env.NODE_ENV !== 'production' && process.env.SWAGGER_ENABLED === '1') {
    try {
      const config = new DocumentBuilder()
        .setTitle('Dal API')
        .setDescription('Marketplace exam platform API')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: true } });
      console.log('📚 Swagger docs: /docs');
    } catch (err) {
      console.warn('⚠️ Swagger atlandı:', (err as Error)?.message || err);
    }
  }
  const reflector = app.get(Reflector);
  const jwtService = new JwtService();
  app.useGlobalGuards(new JwtAuthGuard(jwtService, reflector), new RolesGuard(reflector));
  // Disable Express x-powered-by header for security
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // Trust proxy if configured (for reverse proxy / load balancer setups)
  if (env.TRUST_PROXY === '1' && env.NODE_ENV === 'production') {
    const httpAdapter = app.getHttpAdapter();
    const instance: any = httpAdapter.getInstance();
    if (instance?.set) {
      instance.set('trust proxy', 1);
    }
  }
  // Enable CORS for frontend
  const allowedOrigins = env.CLIENT_URL
    ? env.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean)
    : undefined;
  app.enableCors({
    origin: env.NODE_ENV === 'production' ? allowedOrigins || [] : allowedOrigins || true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const port = env.PORT ? Number(env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Dal API çalışıyor: http://localhost:${port}`);
}

bootstrap();

