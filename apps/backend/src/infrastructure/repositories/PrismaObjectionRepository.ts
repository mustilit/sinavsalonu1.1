import { prisma } from '../database/prisma';
import { IObjectionRepository } from '../../domain/interfaces/IObjectionRepository';

export class PrismaObjectionRepository implements IObjectionRepository {
  async findOverdueOpenObjections(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await prisma.objection.findMany({
      where: { status: 'OPEN', createdAt: { lt: cutoff } },
      select: { id: true, attemptId: true, createdAt: true },
    });
    return rows.map((r) => ({ id: r.id, attemptId: r.attemptId, createdAt: r.createdAt }));
  }

  async markEscalated(ids: string[]) {
    const res = await prisma.objection.updateMany({ where: { id: { in: ids } }, data: { status: 'ESCALATED' } as any });
    return res.count;
  }

  async countByTestAndCandidate(testId: string, candidateId: string) {
    // Count objections where reporter (candidate) reported questions that belong to the given test
    const count = await prisma.objection.count({
      where: {
        reporterId: candidateId,
        question: { testId },
      },
    });
    return count;
  }
}

