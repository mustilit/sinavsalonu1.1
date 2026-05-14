import { prisma } from '../database/prisma';
import { IPurchaseRepository, PurchaseRecord, PurchaseWithAttemptRecord } from '../../domain/interfaces/IPurchaseRepository';

export class PrismaPurchaseRepository implements IPurchaseRepository {
  async hasPurchase(testId: string, candidateId: string): Promise<boolean> {
    const c = await prisma.purchase.count({ where: { testId, candidateId } });
    return c > 0;
  }

  async findById(purchaseId: string): Promise<PurchaseRecord | null> {
    const row = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      select: { id: true, testId: true, candidateId: true, createdAt: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      testId: row.testId,
      candidateId: row.candidateId,
      createdAt: row.createdAt,
    };
  }

  async findByCandidateId(candidateId: string): Promise<PurchaseWithAttemptRecord[]> {
    const withRelations = await (prisma.purchase as any).findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      include: {
        test: { select: { id: true, title: true, status: true, examTypeId: true } },
        package: { select: { id: true, title: true, priceCents: true } },
      },
    });

    const attempts = await prisma.testAttempt.findMany({
      where: { candidateId },
      select: { id: true, testId: true, status: true, startedAt: true, completedAt: true, submittedAt: true, score: true, overtimeSeconds: true },
    });
    const attemptByTest = new Map(attempts.map((a) => [a.testId, a]));

    return (withRelations as any[]).map((p) => ({
      id: p.id,
      testId: p.testId ?? null,
      packageId: p.packageId ?? null,
      candidateId: p.candidateId,
      createdAt: p.createdAt,
      amountCents: p.amountCents ?? null,
      paymentStatus: p.status ?? null,
      test: p.test ?? null,
      package: p.package ?? null,
      attempt: p.testId ? (attemptByTest.get(p.testId) ?? null) : null,
    }));
  }
}

