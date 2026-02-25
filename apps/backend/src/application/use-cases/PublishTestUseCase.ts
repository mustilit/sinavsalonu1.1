import { IExamRepository, ExamWithQuestions } from '../../domain/interfaces/IExamRepository';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaFollowRepository } from '../../infrastructure/repositories/PrismaFollowRepository';
import { RedisCache } from '../../infrastructure/cache/RedisCache';

export class PublishTestUseCase {
  static MIN_QUESTIONS = 5;

  constructor(
    private readonly examRepository: IExamRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly followRepository?: any,
    private readonly cache?: RedisCache
  ) {
    if (!this.followRepository) this.followRepository = new PrismaFollowRepository();
    if (!this.cache) this.cache = new RedisCache();
  }

  /**
   * Validates publish rules using a single query (exam with questions+options).
   * Throws BadRequestException with structured codes on domain violations.
   */
  async execute(testId: string, actorId?: string): Promise<ExamWithQuestions> {
    const test = await this.examRepository.findById(testId);
    if (!test) {
      throw new BadRequestException({ code: 'TEST_NOT_FOUND', message: 'Test not found' });
    }

    // Minimum questions
    const qCount = test.questions?.length ?? 0;
    if (qCount < PublishTestUseCase.MIN_QUESTIONS) {
      throw new BadRequestException({
        code: 'MIN_QUESTIONS_VIOLATION',
        message: `At least ${PublishTestUseCase.MIN_QUESTIONS} questions required`,
      });
    }

    // Per-question validations: options count (2-5), exactly one correct
    for (const q of test.questions) {
      const opts = q.options ?? [];
      if (opts.length < 2 || opts.length > 5) {
        throw new BadRequestException({
          code: 'QUESTION_OPTIONS_VIOLATION',
          message: `Question ${q.id} must have between 2 and 5 options`,
        });
      }
      const correctCount = opts.filter((o) => (o as any).isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException({
          code: 'ONE_CORRECT_OPTION_VIOLATION',
          message: `Question ${q.id} must have exactly one correct option`,
        });
      }
    }

    // Price validation if present
    if (typeof (test as any).price === 'number' && (test as any).price <= 0) {
      throw new BadRequestException({ code: 'PRICE_MUST_BE_POSITIVE', message: 'Price must be > 0' });
    }

    // If timed, ensure duration present and > 0
    if (test.isTimed && (test.duration === null || test.duration === undefined || test.duration <= 0)) {
      throw new BadRequestException({
        code: 'DURATION_REQUIRED_FOR_TIMED_TEST',
        message: 'Timed tests must have a positive duration',
      });
    }

    // Ownership check: if actorId provided, must match educatorId
    if (actorId && test.educatorId && test.educatorId !== actorId) {
      throw new ForbiddenException({ code: 'FORBIDDEN_NOT_OWNER', message: 'Only the educator who owns the test can publish it' });
    }

    // Perform publish (repository handles persistence)
    const published = (await this.examRepository.publish(testId)) as ExamWithQuestions | null;
    if (!published) {
      throw new BadRequestException({ code: 'PUBLISH_FAILED', message: 'Failed to publish test' });
    }

    // Create audit log entry (best-effort)
    try {
      await this.auditLogRepository.create({
        action: 'PUBLISH',
        entityType: 'ExamTest',
        entityId: testId,
        actorId: actorId ?? null,
        metadata: { title: test.title },
      });
    } catch {
      // Audit failure should not block publish; log or handle elsewhere.
    }
    // Invalidate home recommendation cache for followers
    try {
      const followerEduc = test.educatorId ? await this.followRepository.listFollowersForEducator(test.educatorId) : [];
      const followerExamType = (test as any).examTypeId ? await this.followRepository.listFollowersForExamType((test as any).examTypeId) : [];
      const allFollowers = Array.from(new Set([...(followerEduc ?? []), ...(followerExamType ?? [])]));
      await Promise.all(allFollowers.map((fid: string) => this.cache.delByPrefix(`home:rec:${fid}:`)));
    } catch (e) {
      // do not block publish on cache errors
      console.warn('Cache invalidation failed for publish', e);
    }

    // enqueue stats refresh for this test (followers may want updated aggregates)
    try {
      const { QueueService } = require('../../infrastructure/queue/queue.service');
      const qs = new QueueService();
      await qs.enqueueJob('stats-queue', 'refresh', { testId });
    } catch {}

    return published;
  }
}

