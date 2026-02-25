import { AuditLog } from '../../domain/entities/AuditLog';
import { CreateAuditLogInput, IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';
import { randomUUID } from 'crypto';

/**
 * In-memory Audit Log Repository - geliştirme/test
 */
export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLog[] = [];

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const log: AuditLog = {
      id: randomUUID(),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    };
    this.logs.push(log);
    return log;
  }
}
