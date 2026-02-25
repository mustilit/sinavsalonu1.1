/**
 * AuditLog Entity - Kritik işlemler loglanır
 *
 * Zorunlu loglanacak işlemler:
 * - Satın alma (PURCHASE)
 * - İade (REFUND)
 * - Fiyat değişimi (PRICE_CHANGE)
 * - Publish (PUBLISH)
 * - Unpublish (UNPUBLISH)
 */
import { AuditAction } from '../types';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: string; // "ExamTest", "Product", "Order" vb.
  entityId: string;
  actorId: string | null; // işlemi yapan kullanıcı
  metadata: Record<string, unknown>; // eski/yeni değerler, ek bilgiler
  createdAt: Date;
}
