import { IExamRepository } from '../../domain/interfaces/IExamRepository';
import { prisma } from '../../infrastructure/database/prisma';

/**
 * TestPackage ID ile paketin ilk ExamTest'ini getirir (sorular ve seçenekler dahil).
 * Gelen ID her zaman TestPackage ID'sidir.
 */
export class GetTestUseCase {
  constructor(private readonly examRepository: IExamRepository) {}

  async execute(id: string) {
    const firstTest = await prisma.examTest.findFirst({
      where: { packageId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!firstTest) return null;
    return this.examRepository.findById(firstTest.id);
  }
}
