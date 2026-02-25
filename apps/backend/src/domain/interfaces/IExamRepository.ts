import { ExamTest, ExamQuestion, ExamOption } from '../entities/Exam';

export interface ExamWithQuestions extends ExamTest {
  questions: (ExamQuestion & { options: ExamOption[] })[];
}

export interface IExamRepository {
  findById(id: string): Promise<ExamWithQuestions | null>;
  save(test: ExamTest, questions: (ExamQuestion & { options: ExamOption[] })[]): Promise<ExamWithQuestions>;
  publish(id: string): Promise<ExamWithQuestions | null>;
  unpublish(id: string): Promise<ExamWithQuestions | null>;
  findAll(): Promise<ExamWithQuestions[]>;
  findPublished(filters?: {
    examTypeId?: string;
    isTimed?: boolean;
    minPriceCents?: number;
    maxPriceCents?: number;
    page?: number;
    limit?: number;
    sortBy?: 'publishedAt' | 'price' | 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<{ items: ExamWithQuestions[]; total: number }>;
  addQuestion(testId: string, question: ExamQuestion & { options: ExamOption[] }): Promise<ExamWithQuestions>;
  updateQuestion(questionId: string, updates: Partial<ExamQuestion & { options?: ExamOption[] }>): Promise<ExamQuestion | null>;
  listPublishedByFollowed(opts: { educatorIds?: string[]; examTypeIds?: string[]; limit: number; examTypeId?: string | null }): Promise<ExamWithQuestions[]>;
  listPublishedFallback(opts: { excludeIds?: string[]; limit: number; examTypeId?: string | null }): Promise<ExamWithQuestions[]>;
  listPublishedByEducator(opts: { educatorId: string; examTypeId?: string | null; page?: number; limit?: number; sortBy?: 'publishedAt' | 'price' | 'createdAt'; order?: 'asc' | 'desc' }): Promise<{ items: ExamWithQuestions[]; total: number }>;
  findCorrectOptionIdsByQuestionIds(questionIds: string[]): Promise<Record<string, string[]>>;
}
