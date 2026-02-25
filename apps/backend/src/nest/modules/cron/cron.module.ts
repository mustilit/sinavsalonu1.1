import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { PrismaNotificationPreferenceRepository } from '../../../infrastructure/repositories/PrismaNotificationPreferenceRepository';
import { PrismaFollowRepository } from '../../../infrastructure/repositories/PrismaFollowRepository';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository';
import { PrismaObjectionRepository } from '../../../infrastructure/repositories/PrismaObjectionRepository';
import { MockEmailProvider } from '../../../infrastructure/services/MockEmailProvider';
import { SendWeeklyFollowDigestUseCase } from '../../../application/use-cases/SendWeeklyFollowDigestUseCase';
import { SendMonthlyInactiveReminderUseCase } from '../../../application/use-cases/SendMonthlyInactiveReminderUseCase';
import { EscalateOverdueObjectionsUseCase } from '../../../application/use-cases/EscalateOverdueObjectionsUseCase';
import { PrismaAuditLogRepository } from '../../../infrastructure/repositories/PrismaAuditLogRepository';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    CronService,
    PrismaNotificationPreferenceRepository,
    PrismaFollowRepository,
    PrismaUserRepository,
    PrismaObjectionRepository,
    PrismaAuditLogRepository,
    MockEmailProvider,
    {
      provide: SendWeeklyFollowDigestUseCase,
      useFactory: (f: PrismaFollowRepository, p: PrismaNotificationPreferenceRepository, e: MockEmailProvider, a: PrismaAuditLogRepository) =>
        new SendWeeklyFollowDigestUseCase(f, p, e, a),
      inject: [PrismaFollowRepository, PrismaNotificationPreferenceRepository, MockEmailProvider, PrismaAuditLogRepository],
    },
    {
      provide: SendMonthlyInactiveReminderUseCase,
      useFactory: (u: PrismaUserRepository, p: PrismaNotificationPreferenceRepository, e: MockEmailProvider, a: PrismaAuditLogRepository) =>
        new SendMonthlyInactiveReminderUseCase(u, p, e, a),
      inject: [PrismaUserRepository, PrismaNotificationPreferenceRepository, MockEmailProvider, PrismaAuditLogRepository],
    },
    {
      provide: EscalateOverdueObjectionsUseCase,
      useFactory: (o: PrismaObjectionRepository, a: PrismaAuditLogRepository) => new EscalateOverdueObjectionsUseCase(o, a),
      inject: [PrismaObjectionRepository, PrismaAuditLogRepository],
    },
  ],
  exports: [CronService],
})
export class CronModule {}

