import { ExamTest, ExamQuestion, ExamOption } from '../../domain/entities/Exam';
import { ExamWithQuestions, IExamRepository } from '../../domain/interfaces/IExamRepository';

/**
 * In-memory Exam Repository - geliştirme/test
 */
export class InMemoryExamRepository implements IExamRepository {
  private tests: Map<string, ExamWithQuestions> = new Map();

  async findById(id: string): Promise<ExamWithQuestions | null> {
    return this.tests.get(id) ?? null;
  }

  async save(
    test: ExamTest,
    questions: (ExamQuestion & { options: ExamOption[] })[]
  ): Promise<ExamWithQuestions> {
    const full: ExamWithQuestions = {
      ...test,
      questions: questions.map((q) => ({
        ...q,
        testId: test.id,
        options: q.options.map((o) => ({ ...o, questionId: q.id })),
      })),
    };
    this.tests.set(test.id, full);
    return full;
  }

  async publish(id: string): Promise<ExamWithQuestions | null> {
    const test = this.tests.get(id);
    if (!test) return null;
    const published = { ...test, publishedAt: new Date() };
    this.tests.set(id, published);
    return published;
  }

  async unpublish(id: string): Promise<ExamWithQuestions | null> {
    const test = this.tests.get(id);
    if (!test) return null;
    const unpublished = { ...test, publishedAt: null };
    this.tests.set(id, unpublished);
    return unpublished;
  }

  async findAll(): Promise<ExamWithQuestions[]> {
    return Array.from(this.tests.values());
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
    let items = Array.from(this.tests.values()).filter((t) => t.status === 'PUBLISHED' || t.publishedAt != null);
    if (filters) {
      if (filters.examTypeId) {
        items = items.filter((i) => (i as any).examTypeId === filters.examTypeId);
      }
      if (typeof filters.isTimed === 'boolean') {
        items = items.filter((i) => i.isTimed === filters.isTimed);
      }
      if (typeof filters.minPriceCents === 'number') {
        items = items.filter((i) => typeof (i as any).priceCents === 'number' && (i as any).priceCents >= filters.minPriceCents);
      }
      if (typeof filters.maxPriceCents === 'number') {
        items = items.filter((i) => typeof (i as any).priceCents === 'number' && (i as any).priceCents <= filters.maxPriceCents);
      }
    }
    const total = items.length;
    // sorting
    const sortBy = filters?.sortBy ?? 'publishedAt';
    const order = filters?.order === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const amap: any = a as any;
      const bmap: any = b as any;
      const fieldMap: any = { publishedAt: 'publishedAt', price: 'priceCents', createdAt: 'createdAt' };
      const field = fieldMap[sortBy] ?? 'publishedAt';
      const va = amap[field];
      const vb = bmap[field];
      if (va == null && vb == null) return 0;
      if (va == null) return 1 * order;
      if (vb == null) return -1 * order;
      return va > vb ? 1 * order : va < vb ? -1 * order : 0;
    });
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);
    return { items: paged, total };
  }

  async addQuestion(testId: string, question: ExamQuestion & { options: ExamOption[] }): Promise<ExamWithQuestions> {
    const existing = this.tests.get(testId);
    if (!existing) throw new Error('TEST_NOT_FOUND');
    const q = { ...question, testId };
    const updated = { ...existing, questions: [...(existing.questions ?? []), q] };
    this.tests.set(testId, updated);
    return updated;
  }

  async updateQuestion(questionId: string, updates: Partial<ExamQuestion & { options?: ExamOption[] }>): Promise<ExamQuestion | null> {
    for (const [tid, t] of this.tests) {
      const idx = t.questions.findIndex(q => q.id === questionId);
      if (idx >= 0) {
        const old = t.questions[idx];
        const updatedQ = { ...old, ...updates };
        t.questions[idx] = updatedQ;
        this.tests.set(tid, t);
        return updatedQ;
      }
    }
    return null;
  }
  async findCorrectOptionIdsByQuestionIds(questionIds: string[]): Promise<Record<string, string[]>> {
    const map: Record<string, string[]> = {};
    for (const qid of questionIds) map[qid] = [];
    for (const t of this.tests.values()) {
      for (const q of t.questions) {
        if (!questionIds.includes(q.id)) continue;
        for (const o of (q.options ?? [])) {
          if (o.isCorrect) {
            map[q.id] = map[q.id] ?? [];
            map[q.id].push(o.id);
          }
        }
      }
    }
    return map;
  }
}
