import 'reflect-metadata';
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

async function bootstrap() {
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
      hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  // Global pipes and guards
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Global exception filter for consistent error format
  app.useGlobalFilters(new HttpExceptionFilter());
  // Swagger / OpenAPI (non-production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Dal API')
      .setDescription('Marketplace exam platform API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, { swaggerOptions: { persistAuthorization: true } });
  }
  const reflector = app.get(Reflector);
  const jwtService = new JwtService();
  app.useGlobalGuards(new JwtAuthGuard(jwtService, reflector), new RolesGuard(reflector));
  // Disable Express x-powered-by header for security
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // Enable CORS for frontend (development friendly)
  app.enableCors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
  console.log(`🚀 Dal API çalışıyor: http://localhost:${process.env.PORT ? Number(process.env.PORT) : 3000}`);
}

bootstrap();

