import { prisma } from '../database/prisma';
import { IPurchaseRepository } from '../../domain/interfaces/IPurchaseRepository';

export class PrismaPurchaseRepository implements IPurchaseRepository {
  async hasPurchase(testId: string, candidateId: string): Promise<boolean> {
    const c = await prisma.purchase.count({ where: { testId, candidateId } });
    return c > 0;
  }
}

