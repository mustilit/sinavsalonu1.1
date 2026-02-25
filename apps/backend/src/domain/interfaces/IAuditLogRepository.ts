import { AuditLog } from '../entities/AuditLog';
import { AuditAction } from '../types';

export interface CreateAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IAuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLog>;
}
