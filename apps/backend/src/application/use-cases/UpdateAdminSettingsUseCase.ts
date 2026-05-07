import { Injectable } from '@nestjs/common';
import type { AdminSettings } from '../../domain/types';

/** FR-Y-06: Komisyon + KDV ayarı */
@Injectable()
export class UpdateAdminSettingsUseCase {
  async execute(
    prisma: {
      adminSettings: { upsert: (args: any) => Promise<any> };
      $executeRaw?: (query: TemplateStringsArray, ...values: any[]) => Promise<any>;
      $queryRaw?: (query: TemplateStringsArray, ...values: any[]) => Promise<any>;
    },
    input: {
      commissionPercent?: number;
      vatPercent?: number;
      purchasesEnabled?: boolean;
      packageCreationEnabled?: boolean;
      testPublishingEnabled?: boolean;
      testAttemptsEnabled?: boolean;
      adPurchasesEnabled?: boolean;
      minPackagePriceCents?: number;
    },
  ): Promise<AdminSettings> {
    // minPackagePriceCents Prisma client'ın eski sürümünde tanımsız olabilir;
    // güvenli yol: önce normal upsert, sonra raw SQL ile güncelle.
    const row = await prisma.adminSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        commissionPercent: input.commissionPercent ?? 20,
        vatPercent: input.vatPercent ?? 18,
        purchasesEnabled: input.purchasesEnabled ?? true,
        packageCreationEnabled: input.packageCreationEnabled ?? true,
        testPublishingEnabled: input.testPublishingEnabled ?? true,
        testAttemptsEnabled: input.testAttemptsEnabled ?? true,
        adPurchasesEnabled: input.adPurchasesEnabled ?? true,
      },
      update: {
        ...(input.commissionPercent !== undefined && { commissionPercent: input.commissionPercent }),
        ...(input.vatPercent !== undefined && { vatPercent: input.vatPercent }),
        ...(input.purchasesEnabled !== undefined && { purchasesEnabled: input.purchasesEnabled }),
        ...(input.packageCreationEnabled !== undefined && { packageCreationEnabled: input.packageCreationEnabled }),
        ...(input.testPublishingEnabled !== undefined && { testPublishingEnabled: input.testPublishingEnabled }),
        ...(input.testAttemptsEnabled !== undefined && { testAttemptsEnabled: input.testAttemptsEnabled }),
        ...(input.adPurchasesEnabled !== undefined && { adPurchasesEnabled: input.adPurchasesEnabled }),
      },
    });

    // minPackagePriceCents için raw SQL — Prisma client versiyonundan bağımsız
    if (input.minPackagePriceCents !== undefined && prisma.$executeRaw) {
      await prisma.$executeRaw`
        UPDATE admin_settings
        SET "minPackagePriceCents" = ${input.minPackagePriceCents}
        WHERE id = 1
      `;
    }

    // Güncel değeri raw okuyarak döndür
    let minPackagePriceCents = 100;
    if (prisma.$queryRaw) {
      const result = await prisma.$queryRaw`SELECT "minPackagePriceCents" FROM admin_settings WHERE id = 1` as any[];
      minPackagePriceCents = result[0]?.minPackagePriceCents ?? 100;
    } else {
      minPackagePriceCents = (row as any).minPackagePriceCents ?? 100;
    }

    return {
      commissionPercent: row.commissionPercent,
      vatPercent: row.vatPercent,
      purchasesEnabled: row.purchasesEnabled,
      packageCreationEnabled: row.packageCreationEnabled ?? true,
      testPublishingEnabled: row.testPublishingEnabled ?? true,
      testAttemptsEnabled: row.testAttemptsEnabled ?? true,
      adPurchasesEnabled: (row as any).adPurchasesEnabled ?? true,
      minPackagePriceCents,
    };
  }
}
