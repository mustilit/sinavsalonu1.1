import { AuditLog } from '../../domain/entities/AuditLog';
import { CreateAuditLogInput, IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';
import { prisma } from '../database/prisma';

/**
 * Prisma Audit Log Repository
 */
export class PrismaAuditLogRepository implements IAuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const created = await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    });
    return this.toDomain(created);
  }

  private toDomain(row: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    metadata: unknown;
    createdAt: Date;
  }): AuditLog {
    return {
      id: row.id,
      action: row.action as AuditLog['action'],
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
    };
  }
}
