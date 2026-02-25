import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nestjs/throttler-storage-redis';
import IORedis from 'ioredis';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './guards/throttler.guard';
import { TestsController } from './controllers/tests.controller';
import { RootController } from './controllers/root.controller';
import { HealthController } from './controllers/health.controller';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ExamTypesModule } from './modules/exam-types/exam-types.module';
import { TestsModule } from './modules/tests/tests.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { AuditModule } from './modules/audit/audit.module';
import { CronModule } from './modules/cron/cron.module';
import { NotificationsController } from './controllers/notifications.controller';
import { AdminDlqController } from './controllers/admin.dlq.controller';
import { TestsPerformanceController } from './controllers/tests.performance.controller';
import { HomeController } from './controllers/home.controller';
import { ReviewsController } from './controllers/reviews.controller';
import { EducatorsController } from './controllers/educators.controller';
import { FollowsController } from './controllers/follows.controller';
import { CspReportController } from './controllers/csp-report.controller';
import { SeedService } from './bootstrap/seed.service';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          const redis = new IORedis(redisUrl, { maxRetriesPerRequest: 2 });
          // graceful shutdown hooks (best-effort)
          const shutdown = () => {
            try {
              redis.disconnect();
            } catch (e) {
              /* ignore */
            }
          };
          process.on('beforeExit', shutdown);
          process.on('SIGINT', () => {
            shutdown();
            process.exit(0);
          });
          process.on('SIGTERM', () => {
            shutdown();
            process.exit(0);
          });
          return { ttl: 60, limit: 60, storage: new ThrottlerStorageRedisService(redis) };
        }
        // fallback to in-memory store (fail-open)
        return { ttl: 60, limit: 60 };
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    MarketplaceModule,
    ExamTypesModule,
    TestsModule,
    QuestionsModule,
    PurchasesModule,
    AttemptsModule,
    AuditModule,
    CronModule,
    // Refunds
    (require('./modules/refunds/refunds.module').RefundsModule),
  ],
  controllers: [RootController, HealthController, NotificationsController, AdminDlqController, TestsPerformanceController, HomeController, ReviewsController, EducatorsController, FollowsController, CspReportController],
  providers: [
    SeedService,
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
  ],
})
export class AppModule {}

