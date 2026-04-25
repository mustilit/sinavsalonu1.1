import { IExamRepository } from '../../domain/interfaces/IExamRepository';
import { randomUUID } from 'crypto';

/**
 * Test paketine yeni soru ekler.
 * Soru ve seçenek ID'leri sunucu tarafında üretilir (UUID v4).
 * order verilmezse 0 atanır; eğitici daha sonra sıralamayı düzenleyebilir.
 */
export class CreateQuestionUseCase {
  constructor(private readonly examRepository: IExamRepository) {}

  async execute(testId: string, input: { content: string; order?: number; options: { content: string; isCorrect: boolean }[]; solutionText?: string | null; solutionMediaUrl?: string | null }) {
    // ID'ler sunucuda üretilir — istemci tarafı ID enjeksiyonu engellenir
    const qId = randomUUID();
    const question = {
      id: qId,
      testId,
      content: input.content,
      order: input.order ?? 0,
      solutionText: input.solutionText ?? null,
      solutionMediaUrl: input.solutionMediaUrl ?? null,
      options: input.options.map(o => ({ id: randomUUID(), content: o.content, isCorrect: o.isCorrect })),
    };
    return this.examRepository.addQuestion(testId, question as any);
  }
}

