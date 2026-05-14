import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import type { PrismaClient } from '@prisma/client';
import { StartTestAttemptUseCase } from '../../application/use-cases/StartTestAttemptUseCase';
import { PauseTestAttemptUseCase } from '../../application/use-cases/PauseTestAttemptUseCase';
import { ResumeTestAttemptUseCase } from '../../application/use-cases/ResumeTestAttemptUseCase';
import { GetTestAttemptUseCase } from '../../application/use-cases/GetTestAttemptUseCase';
import { SubmitAnswerUseCase } from '../../application/use-cases/SubmitAnswerUseCase';
import { GetAttemptStateUseCase } from '../../application/use-cases/GetAttemptStateUseCase';
import { GetAttemptResultUseCase } from '../../application/use-cases/GetAttemptResultUseCase';
import { SubmitAttemptUseCase } from '../../application/use-cases/SubmitAttemptUseCase';
import { TimeoutAttemptUseCase } from '../../application/use-cases/TimeoutAttemptUseCase';
import { PrismaAttemptRepository } from '../../infrastructure/repositories/PrismaAttemptRepository';
import { PrismaExamRepository } from '../../infrastructure/repositories/PrismaExamRepository';
import { PrismaAttemptAnswerRepository } from '../../infrastructure/repositories/PrismaAttemptAnswerRepository';
import { PrismaService } from '../modules/prisma/prisma.service';

/**
 * Test denemesi yaşam döngüsünü yönetir: başlatma, duraklatma, devam etme,
 * cevap gönderme ve mevcut deneme durumunu sorgulama.
 * Tüm endpoint'ler CANDIDATE rolüne kısıtlıdır.
 *
 * Not: Bu controller use-case'leri Prisma inject ile manuel olarak oluşturur
 * (NestJS modül DI yerine); tutarlılık için ileride modüle taşınabilir.
 */
@Controller()
export class AttemptsController {
  private readonly startUC: StartTestAttemptUseCase;
  private readonly pauseUC: PauseTestAttemptUseCase;
  private readonly resumeUC: ResumeTestAttemptUseCase;
  private readonly getUC: GetTestAttemptUseCase;
  private readonly submitAnswerUC: SubmitAnswerUseCase;
  private readonly getStateUC: GetAttemptStateUseCase;
  private readonly getResultUC: GetAttemptResultUseCase;
  private readonly submitAttemptUC: SubmitAttemptUseCase;
  private readonly timeoutUC: TimeoutAttemptUseCase;

  constructor(@Inject(PrismaService) prismaService: PrismaService) {
    const prisma: PrismaClient = prismaService.client;
    this.startUC = new StartTestAttemptUseCase(prisma);
    this.pauseUC = new PauseTestAttemptUseCase(prisma);
    this.resumeUC = new ResumeTestAttemptUseCase(prisma);
    this.getUC = new GetTestAttemptUseCase(prisma);
    this.submitAnswerUC = new SubmitAnswerUseCase(prisma);
    this.submitAttemptUC = new SubmitAttemptUseCase(prisma);

    const attemptRepo = new PrismaAttemptRepository();
    const examRepo = new PrismaExamRepository();
    const answerRepo = new PrismaAttemptAnswerRepository();
    this.getStateUC = new GetAttemptStateUseCase(attemptRepo, examRepo, answerRepo);
    this.getResultUC = new GetAttemptResultUseCase(attemptRepo, examRepo, answerRepo);
    this.timeoutUC = new TimeoutAttemptUseCase(attemptRepo, examRepo, answerRepo);
  }

  /** Yeni deneme başlatır — tenantId çoklu kiracı senaryosu için iletilir */
  @Post('tests/:id/start')
  @Roles('CANDIDATE')
  async start(@Param('id') testId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenant?.id;
    return this.startUC.execute(testId, userId, tenantId);
  }

  @Post('attempts/:id/pause')
  @Roles('CANDIDATE')
  async pause(@Param('id') attemptId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    return this.pauseUC.execute(attemptId, userId);
  }

  @Post('attempts/:id/resume')
  @Roles('CANDIDATE')
  async resume(@Param('id') attemptId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    return this.resumeUC.execute(attemptId, userId);
  }

  @Post('attempts/:id/answer')
  @Roles('CANDIDATE')
  async answer(
    @Param('id') attemptId: string,
    @Body() body: { questionId: string; selectedOptionId?: string | null },
    @Req() req: any,
  ) {
    const userId = (req as any).user?.id;
    return this.submitAnswerUC.execute(attemptId, body.questionId, body.selectedOptionId, userId);
  }

  /** dalClient.js submitAnswer → POST /attempts/:id/answers (plural) */
  @Post('attempts/:id/answers')
  @Roles('CANDIDATE')
  async answers(
    @Param('id') attemptId: string,
    @Body() body: { questionId: string; optionId?: string | null; selectedOptionId?: string | null },
    @Req() req: any,
  ) {
    const userId = (req as any).user?.id;
    const optionId = body.optionId ?? body.selectedOptionId ?? null;
    return this.submitAnswerUC.execute(attemptId, body.questionId, optionId, userId);
  }

  /** dalClient.js getState → GET /attempts/:id/state */
  @Get('attempts/:id/state')
  @Roles('CANDIDATE')
  async state(@Param('id') attemptId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    return this.getStateUC.execute(attemptId, userId);
  }

  /** dalClient.js finish → POST /attempts/:id/finish */
  @Post('attempts/:id/finish')
  @Roles('CANDIDATE')
  async finish(@Param('id') attemptId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    return this.submitAttemptUC.execute(attemptId, undefined, userId);
  }

  /** dalClient.js timeout → POST /attempts/:id/timeout */
  @Post('attempts/:id/timeout')
  @Roles('CANDIDATE')
  async timeout(@Param('id') attemptId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    return this.timeoutUC.execute(attemptId, userId);
  }

  /** dalClient.js getResult → GET /attempts/:id/result */
  @Get('attempts/:id/result')
  @Roles('CANDIDATE')
  async result(@Param('id') attemptId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    return this.getResultUC.execute(attemptId, userId);
  }

  @Get('attempts/:id')
  @Roles('CANDIDATE')
  async get(@Param('id') attemptId: string, @Req() req: any) {
    const userId = (req as any).user?.id;
    return this.getUC.execute(attemptId, userId);
  }
}

