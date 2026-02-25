import { prisma } from '../database/prisma';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';

export class PrismaUserRepository implements IUserRepository {
  async updateLastLoginAt(userId: string, date: Date): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: date as any } as any });
  }

  async listInactiveUsersWithOpenAttempts(days: number): Promise<{ userId: string; attemptId: string }[]> {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await prisma.testAttempt.findMany({
      where: {
        status: 'IN_PROGRESS',
        startedAt: { lt: cutoff },
      },
      select: { candidateId: true, id: true },
    });
    return rows.map((r) => ({ userId: r.candidateId, attemptId: r.id }));
  }
}

import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { prisma } from '../database/prisma';

/**
 * Prisma User Repository
 * Kritik işlemler $transaction içinde atomic yapılır
 */
export class PrismaUserRepository implements IUserRepository {
  async save(user: User): Promise<User> {
    return prisma.$transaction(async (tx) => {
      // Unique constraint: email kontrolü (atomic)
      const existingByEmail = await tx.user.findUnique({
        where: { email: user.email.toLowerCase() },
      });
      if (existingByEmail && existingByEmail.id !== user.id) {
        throw new Error('DUPLICATE_EMAIL');
      }

      // Unique constraint: username kontrolü (atomic)
      const existingByUsername = await tx.user.findUnique({
        where: { username: user.username },
      });
      if (existingByUsername && existingByUsername.id !== user.id) {
        throw new Error('DUPLICATE_USERNAME');
      }

      const created = await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email.toLowerCase(),
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
          metadata: (user.metadata ?? {}) as any,
        },
        update: {
          email: user.email.toLowerCase(),
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
          metadata: (user.metadata ?? {}) as any,
        },
      });

      return this.toDomain(created);
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? this.toDomain(user) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { username },
    });
    return user ? this.toDomain(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user ? this.toDomain(user) : null;
  }

  private toDomain(row: { id: string; email: string; username: string; passwordHash: string; role: string; status?: string | null; metadata?: any; createdAt: Date; updatedAt: Date }): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.passwordHash,
      role: row.role as User['role'],
      status: (row.status as User['status']) ?? 'ACTIVE',
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
