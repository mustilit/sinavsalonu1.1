export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

export type UserRole = 'ADMIN' | 'EDUCATOR' | 'CANDIDATE';

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TIMEOUT';

export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
export type PurchaseStatus = 'ACTIVE' | 'REFUNDED' | 'EXPIRED';

export type ReviewStatus = 'pending' | 'in_progress' | 'completed';

export type Severity = 'info' | 'warning' | 'error';

export type SuggestionCategory =
  | 'performance'
  | 'security'
  | 'readability'
  | 'best_practice'
  | 'refactoring';

export type AuditAction =
  | 'PURCHASE'
  | 'SUBMIT_ANSWER'
  | 'SUBMIT_ATTEMPT'
  | 'TEST_PUBLISHED'
  | 'TEST_UNPUBLISHED'
  | 'PRICE_CHANGED'
  | 'REFUND_REQUESTED'
  | 'REFUND_RESOLVED'
  | 'OBJECTION_CREATED'
  | 'OBJECTION_ANSWERED'
  | 'DISCOUNT_CREATED'
  | 'REVIEW_CREATED'
  | 'EDUCATOR_SUSPENDED';

// extended audit actions
export type ExtendedAuditAction =
  | AuditAction
  | 'NOTIFICATIONS_DISABLED'
  | 'EMAIL_SENT'
  | 'OBJECTION_ESCALATED'
  | 'EMAIL_FAILED'
  | 'SUSPICIOUS_RATE_LIMIT'
  | 'CSP_VIOLATION';

export type Money = {
  cents: number;
  currency: string;
};

export type DiscountCode = {
  id: string;
  code: string;
  percentOff: number; // 0-100
  maxUses?: number | null;
  usedCount: number;
  validFrom?: string | null;
  validUntil?: string | null;
};

export type AdminSettings = {
  commissionPercent: number;
  vatPercent: number;
  purchasesEnabled: boolean;
};

