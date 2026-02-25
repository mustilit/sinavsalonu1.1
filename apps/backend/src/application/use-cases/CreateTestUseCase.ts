import { IExamRepository } from '../../domain/interfaces/IExamRepository';
import { ExamTest, ExamQuestion } from '../../domain/entities/Exam';
import { randomUUID } from 'crypto';

export class CreateTestUseCase {
  constructor(private readonly examRepository: IExamRepository) {}

  async execute(input: { title: string; isTimed?: boolean; duration?: number; price?: number; educatorId?: string; questions?: (ExamQuestion & { options: any[] })[] }) {
    const id = randomUUID();
    const test: ExamTest = {
      id,
      title: input.title,
      isTimed: !!input.isTimed,
      duration: input.duration ?? null,
      status: 'DRAFT',
      educatorId: input.educatorId ?? null,
      metadata: {},
      price: input.price,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const questions = (input.questions ?? []).map(q => ({ ...q, id: q.id ?? randomUUID() }));
    return this.examRepository.save(test, questions);
  }
}

