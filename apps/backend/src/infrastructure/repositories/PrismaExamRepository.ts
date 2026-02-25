import { ExamTest, ExamQuestion, ExamOption } from '../../domain/entities/Exam';
import { ExamWithQuestions, IExamRepository } from '../../domain/interfaces/IExamRepository';
import { prisma } from '../database/prisma';

/**
 * Prisma Exam Repository
 * Kritik işlemler $transaction ile atomic
 */
export class PrismaExamRepository implements IExamRepository {
  async findById(id: string): Promise<ExamWithQuestions | null> {
    const test = await prisma.examTest.findUnique({
      where: { id },
      include: {
        questions: {
          include: { options: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    return test ? this.toDomain(test) : null;
  }

  async save(
    test: ExamTest,
    questions: (ExamQuestion & { options: ExamOption[] })[]
  ): Promise<ExamWithQuestions> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.examTest.create({
        data: {
          id: test.id,
          title: test.title,
          educatorId: (test as any).educatorId ?? null,
          isTimed: test.isTimed,
          duration: test.duration,
          questions: {
            create: questions.map((q) => ({
              id: q.id,
              content: q.content,
              order: q.order,
              options: {
                create: q.options.map((o) => ({
                  id: o.id,
                  content: o.content,
                  isCorrect: o.isCorrect,
                })),
              },
            })),
          },
        },
        include: {
          questions: { include: { options: true }, orderBy: { order: 'asc' } },
        },
      });
      return this.toDomain(created);
    });
  }

  async findAll(): Promise<ExamWithQuestions[]> {
    const reviews = await prisma.examTest.findMany({
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return reviews.map(this.toDomain);
  }

  async findPublished(filters?: {
    examTypeId?: string;
    isTimed?: boolean;
    minPriceCents?: number;
    maxPriceCents?: number;
    page?: number;
    limit?: number;
    sortBy?: 'publishedAt' | 'price' | 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<{ items: ExamWithQuestions[]; total: number }> {
    const where: any = { status: 'PUBLISHED' };
    if (filters) {
      if (filters.examTypeId) where.examTypeId = filters.examTypeId;
      if (typeof filters.isTimed === 'boolean') where.isTimed = filters.isTimed;
      if (typeof filters.minPriceCents === 'number' || typeof filters.maxPriceCents === 'number') {
        where.priceCents = {};
        if (typeof filters.minPriceCents === 'number') where.priceCents.gte = filters.minPriceCents;
        if (typeof filters.maxPriceCents === 'number') where.priceCents.lte = filters.maxPriceCents;
      }
    }

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const sortByMap: any = {
      publishedAt: 'publishedAt',
      price: 'priceCents',
      createdAt: 'createdAt',
    };
    const sortField = sortByMap[filters?.sortBy ?? 'publishedAt'];
    const order: any = filters?.order ?? 'desc';

    const [total, tests] = await Promise.all([
      prisma.examTest.count({ where }),
      prisma.examTest.findMany({
        where,
        include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
        orderBy: { [sortField]: order },
        skip,
        take: limit,
      }),
    ]);

    return { items: tests.map(this.toDomain), total };
  }

  async listPublishedByFollowed(opts: { educatorIds?: string[]; examTypeIds?: string[]; limit: number; examTypeId?: string | null }): Promise<ExamWithQuestions[]> {
    const where: any = { status: 'PUBLISHED' };
    if (opts.examTypeId) where.examTypeId = opts.examTypeId;
    const or: any[] = [];
    if (opts.educatorIds && opts.educatorIds.length) or.push({ educatorId: { in: opts.educatorIds } });
    if (opts.examTypeIds && opts.examTypeIds.length) or.push({ examTypeId: { in: opts.examTypeIds } });
    if (or.length) where.OR = or;
    const tests = await prisma.examTest.findMany({
      where,
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
      orderBy: [{ publishedAt: 'desc' }],
      take: opts.limit,
    });
    return tests.map(this.toDomain);
  }

  async listPublishedFallback(opts: { excludeIds?: string[]; limit: number; examTypeId?: string | null }): Promise<ExamWithQuestions[]> {
    const where: any = { status: 'PUBLISHED' };
    if (opts.examTypeId) where.examTypeId = opts.examTypeId;
    if (opts.excludeIds && opts.excludeIds.length) where.id = { notIn: opts.excludeIds };
    const tests = await prisma.examTest.findMany({
      where,
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
      orderBy: [{ publishedAt: 'desc' }],
      take: opts.limit,
    });
    return tests.map(this.toDomain);
  }

  async listPublishedByEducator(opts: { educatorId: string; examTypeId?: string | null; page?: number; limit?: number; sortBy?: 'publishedAt' | 'price' | 'createdAt'; order?: 'asc' | 'desc' }): Promise<{ items: ExamWithQuestions[]; total: number }> {
    const where: any = { status: 'PUBLISHED', educatorId: opts.educatorId };
    if (opts.examTypeId) where.examTypeId = opts.examTypeId;
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 20;
    const skip = (page - 1) * limit;
    const sortField = opts.sortBy ?? 'publishedAt';
    const order: any = opts.order ?? 'desc';
    const [total, tests] = await Promise.all([
      prisma.examTest.count({ where }),
      prisma.examTest.findMany({
        where,
        include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
        orderBy: { [sortField]: order },
        skip,
        take: limit,
      }),
    ]);
    return { items: tests.map(this.toDomain), total };
  }

  async findCorrectOptionIdsByQuestionIds(questionIds: string[]): Promise<Record<string, string[]>> {
    if (!questionIds || questionIds.length === 0) return {};
    const rows: any[] = await prisma.examOption.findMany({
      where: { questionId: { in: questionIds }, isCorrect: true },
      select: { id: true, questionId: true },
    });
    const map: Record<string, string[]> = {};
    for (const r of rows) {
      map[r.questionId] = map[r.questionId] ?? [];
      map[r.questionId].push(r.id);
    }
    return map;
  }

  async addQuestion(testId: string, question: ExamQuestion & { options: ExamOption[] }): Promise<ExamWithQuestions> {
    return prisma.$transaction(async (tx) => {
      await tx.examQuestion.create({
        data: {
          id: question.id,
          testId,
          content: question.content,
          order: question.order,
          options: {
            create: question.options.map((o) => ({
              id: o.id,
              content: o.content,
              isCorrect: o.isCorrect,
            })),
          },
        },
      });
      const updated = await tx.examTest.findUnique({
        where: { id: testId },
        include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
      });
      return this.toDomain(updated as any);
    });
  }

  async updateQuestion(questionId: string, updates: Partial<ExamQuestion & { options?: ExamOption[] }>): Promise<ExamQuestion | null> {
    const q = await prisma.examQuestion.update({
      where: { id: questionId },
      data: { ...(updates.content !== undefined && { content: updates.content }), ...(updates.order !== undefined && { order: updates.order }) },
    });
    return {
      id: q.id,
      testId: q.testId,
      content: q.content,
      order: q.order,
      options: [],
    };
  }

  async publish(id: string): Promise<ExamWithQuestions | null> {
    const updated = await prisma.examTest.update({
      where: { id },
      data: { publishedAt: new Date() },
      include: {
        questions: { include: { options: true }, orderBy: { order: 'asc' } },
      },
    });
    return this.toDomain(updated);
  }

  async unpublish(id: string): Promise<ExamWithQuestions | null> {
    const updated = await prisma.examTest.update({
      where: { id },
      data: { publishedAt: null },
      include: {
        questions: { include: { options: true }, orderBy: { order: 'asc' } },
      },
    });
    return this.toDomain(updated);
  }

  private toDomain(row: {
    id: string;
    title: string;
    isTimed: boolean;
    duration: number | null;
    publishedAt: Date | null;
    status?: string | null;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
    questions: Array<{
      id: string;
      content: string;
      order: number;
      options: Array<{ id: string; content: string; isCorrect: boolean }>;
      solutionText?: string | null;
      solutionMediaUrl?: string | null;
    }>;
  }): ExamWithQuestions {
    return {
      id: row.id,
      title: row.title,
      isTimed: row.isTimed,
      duration: row.duration,
      status: (row.status as ExamWithQuestions['status']) ?? 'DRAFT',
      hasSolutions: (row as any).hasSolutions ?? false,
      educatorId: (row as any).educatorId ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      questions: row.questions.map((q) => ({
        id: q.id,
        testId: row.id,
        content: q.content,
        order: q.order,
        options: q.options.map((o) => ({
          id: o.id,
          questionId: q.id,
          content: o.content,
          isCorrect: o.isCorrect,
        })),
        solutionText: (q as any).solutionText ?? null,
        solutionMediaUrl: (q as any).solutionMediaUrl ?? null,
      })),
    };
  }
}
