import type { RefundListItem } from '../../domain/interfaces/IRefundRepository';
import type { IRefundRepository } from '../../domain/interfaces/IRefundRepository';

/**
 * Admin paneli için belirli statüdeki iade taleplerini listeler.
 * PENDING (bekleyen), APPROVED (onaylanan) veya REJECTED (reddedilen) talepleri getirebilir.
 */
export class ListPendingRefundsUseCase {
  constructor(private readonly refundRepo: IRefundRepository) {}

  /**
   * Verilen statüdeki iade taleplerini döner.
   * @param status - Filtrelenecek iade statüsü.
   */
  async execute(status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<RefundListItem[]> {
    return this.refundRepo.findByStatus(status);
  }
}
