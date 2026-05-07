import { Injectable } from '@nestjs/common';
import { prisma } from '../database/prisma';
import {
  ITestPackageRepository,
  TestPackageRecord,
  TestPackageTest,
  CreateTestPackageInput,
  UpdateTestPackageInput,
} from '../../domain/interfaces/ITestPackageRepository';

@Injectable()
export class PrismaTestPackageRepository implements ITestPackageRepository {
  private mapTest(t: any): TestPackageTest {
    return {
      id: t.id,
      title: t.title,
      isTimed: t.isTimed,
      duration: t.duration ?? null,
      durationSec: t.durationSec ?? null,
      questionCount: t._count?.questions ?? t.questionCount ?? null,
      status: t.status,
      publishedAt: t.publishedAt ?? null,
    };
  }

  private mapRecord(pkg: any, includeTests = false): TestPackageRecord {
    return {
      id: pkg.id,
      tenantId: pkg.tenantId,
      educatorId: pkg.educatorId ?? null,
      title: pkg.title,
      description: pkg.description ?? null,
      priceCents: pkg.priceCents,
      isActive: pkg.isActive,
      publishedAt: pkg.publishedAt ?? null,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
      ...(includeTests && { tests: (pkg.tests ?? []).map((t: any) => this.mapTest(t)) }),
    };
  }

  async create(input: CreateTestPackageInput): Promise<TestPackageRecord> {
    const pkg = await (prisma.testPackage as any).create({
      data: {
        tenantId: input.tenantId,
        educatorId: input.educatorId,
        title: input.title,
        description: input.description ?? null,
        priceCents: input.priceCents,
      },
    });
    return this.mapRecord(pkg);
  }

  async findById(id: string): Promise<TestPackageRecord | null> {
    const pkg = await (prisma.testPackage as any).findUnique({ where: { id } });
    return pkg ? this.mapRecord(pkg) : null;
  }

  async findByIdWithTests(id: string): Promise<TestPackageRecord | null> {
    const pkg = await (prisma.testPackage as any).findUnique({
      where: { id },
      include: {
        tests: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
      },
    });
    return pkg ? this.mapRecord(pkg, true) : null;
  }

  async findByEducatorId(educatorId: string): Promise<TestPackageRecord[]> {
    const pkgs = await (prisma.testPackage as any).findMany({
      where: { educatorId },
      include: {
        tests: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return pkgs.map((p: any) => this.mapRecord(p, true));
  }

  async update(id: string, input: UpdateTestPackageInput): Promise<TestPackageRecord> {
    const pkg = await (prisma.testPackage as any).update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
      },
    });
    return this.mapRecord(pkg);
  }

  async addTest(packageId: string, testId: string): Promise<void> {
    await prisma.examTest.update({
      where: { id: testId },
      data: { packageId },
    });
  }

  async removeTest(packageId: string, testId: string): Promise<void> {
    // Sadece bu pakete ait ise null'a çek
    await prisma.examTest.updateMany({
      where: { id: testId, packageId },
      data: { packageId: null },
    });
  }

  async publish(id: string): Promise<TestPackageRecord> {
    const pkg = await (prisma.testPackage as any).update({
      where: { id },
      data: { publishedAt: new Date(), isActive: true },
    });
    return this.mapRecord(pkg);
  }

  async unpublish(id: string): Promise<TestPackageRecord> {
    const pkg = await (prisma.testPackage as any).update({
      where: { id },
      data: { publishedAt: null, isActive: false },
    });
    return this.mapRecord(pkg);
  }
}
