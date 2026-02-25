import { Module } from '@nestjs/common';
import { TestsController } from '../../controllers/tests.controller';
import { TestsService } from './tests.service';
import { TestPublishProvider } from './test-publish.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TestPublishService as AppTestPublishService } from '../../../application/services/TestPublishService';
import { CreateTestUseCase } from '../../../application/use-cases/CreateTestUseCase';
import { CreateQuestionUseCase } from '../../../application/use-cases/CreateQuestionUseCase';
import { ListMarketplaceTestsUseCase } from '../../../application/use-cases/ListMarketplaceTestsUseCase';
import { GetTestUseCase } from '../../../application/use-cases/GetTestUseCase';
import { PublishTestUseCase } from '../../../application/use-cases/PublishTestUseCase';
import { UnpublishTestUseCase } from '../../../application/use-cases/UnpublishTestUseCase';
import { PrismaExamRepository } from '../../../infrastructure/repositories/PrismaExamRepository';
import { PrismaAuditLogRepository } from '../../../infrastructure/repositories/PrismaAuditLogRepository';

@Module({
  imports: [PrismaModule],
  controllers: [TestsController],
  providers: [
    TestsService,
    TestPublishProvider,
    {
      provide: AppTestPublishService,
      useClass: TestPublishProvider,
    },
    {
      provide: CreateTestUseCase,
      useFactory: () => new CreateTestUseCase(new PrismaExamRepository()),
    },
    {
      provide: CreateQuestionUseCase,
      useFactory: () => new CreateQuestionUseCase(new PrismaExamRepository()),
    },
    {
      provide: ListMarketplaceTestsUseCase,
      useFactory: () => new ListMarketplaceTestsUseCase(new PrismaExamRepository()),
    },
    {
      provide: GetTestUseCase,
      useFactory: () => new GetTestUseCase(new PrismaExamRepository()),
    },
    {
      provide: PublishTestUseCase,
      useFactory: () => new PublishTestUseCase(new PrismaExamRepository(), new PrismaAuditLogRepository()),
    },
    {
      provide: UnpublishTestUseCase,
      useFactory: () => new UnpublishTestUseCase(new PrismaExamRepository(), new PrismaAuditLogRepository()),
    },
  ],
  exports: [TestsService],
})
export class TestsModule {}

