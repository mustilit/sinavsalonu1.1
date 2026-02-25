import { prisma } from '../database/prisma';
import { IRefundRepository, RefundRequest } from '../../domain/interfaces/IRefundRepository';

export class PrismaRefundRepository implements IRefundRepository {
  async create(input: { purchaseId: string; candidateId: string; testId: string; reason?: string }): Promise<RefundRequest> {
    const r = await prisma.refundRequest.create({ data: { purchaseId: input.purchaseId, candidateId: input.candidateId, testId: input.testId, reason: input.reason ?? null } });
    return this.toDomain(r);
  }

  async findByPurchaseId(purchaseId: string): Promise<RefundRequest | null> {
    const r = await prisma.refundRequest.findUnique({ where: { purchaseId } as any });
    return r ? this.toDomain(r) : null;
  }

  async findById(id: string): Promise<RefundRequest | null> {
    const r = await prisma.refundRequest.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED', decidedBy: string): Promise<RefundRequest> {
    const r = await prisma.refundRequest.update({ where: { id }, data: { status, decidedBy, decidedAt: new Date() } as any });
    return this.toDomain(r);
  }

  private toDomain(row: any): RefundRequest {
    return {
      id: row.id,
      purchaseId: row.purchaseId,
      candidateId: row.candidateId,
      testId: row.testId,
      reason: row.reason,
      status: row.status,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

