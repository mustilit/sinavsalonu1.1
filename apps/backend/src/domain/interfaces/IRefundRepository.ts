export type RefundRequest = {
  id: string;
  purchaseId: string;
  candidateId: string;
  testId: string;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

export interface IRefundRepository {
  create(input: { purchaseId: string; candidateId: string; testId: string; reason?: string }): Promise<RefundRequest>;
  findByPurchaseId(purchaseId: string): Promise<RefundRequest | null>;
  findById(id: string): Promise<RefundRequest | null>;
  updateStatus(id: string, status: 'APPROVED' | 'REJECTED', decidedBy: string): Promise<RefundRequest>;
}

