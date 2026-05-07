import { Injectable } from '@nestjs/common';
import type { AdminSettings } from '../../domain/types';

/** FR-Y-06: Komisyon + KDV ayarı */
@Injectable()
export class UpdateAdminSettingsUseCase {
  async execute(
    prisma: { adminSettings: { upsert: (args: any) => Promise<any> } },
    input: {
      commissionPercent?: number;
      vatPercent?: number;
      purchasesEnabled?: boolean;
      packageCreationEnabled?: boolean;
      testPublishingEnabled?: boolean;
      testAttemptsEnabled?: boolean;
      /** Eğitici reklam satın alma kill-switch'i */
      adPurchasesEnabled?: boolean;
      /** Minimum paket fiyatı (kuruş) */
      minPackagePriceCents?: number;
    },
  ): Promise<AdminSettings> {
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
        minPackagePriceCents: input.minPackagePriceCents ?? 100,
      },
      update: {
        ...(input.commissionPercent !== undefined && { commissionPercent: input.commissionPercent }),
        ...(input.vatPercent !== undefined && { vatPercent: input.vatPercent }),
        ...(input.purchasesEnabled !== undefined && { purchasesEnabled: input.purchasesEnabled }),
        ...(input.packageCreationEnabled !== undefined && { packageCreationEnabled: input.packageCreationEnabled }),
        ...(input.testPublishingEnabled !== undefined && { testPublishingEnabled: input.testPublishingEnabled }),
        ...(input.testAttemptsEnabled !== undefined && { testAttemptsEnabled: input.testAttemptsEnabled }),
        ...(input.adPurchasesEnabled !== undefined && { adPurchasesEnabled: input.adPurchasesEnabled }),
        ...(input.minPackagePriceCents !== undefined && { minPackagePriceCents: input.minPackagePriceCents }),
      },
    });
    return {
      commissionPercent: row.commissionPercent,
      vatPercent: row.vatPercent,
      purchasesEnabled: row.purchasesEnabled,
      packageCreationEnabled: row.packageCreationEnabled ?? true,
      testPublishingEnabled: row.testPublishingEnabled ?? true,
      testAttemptsEnabled: row.testAttemptsEnabled ?? true,
      adPurchasesEnabled: (row as any).adPurchasesEnabled ?? true,
      minPackagePriceCents: (row as any).minPackagePriceCents ?? 100,
    };
  }
}
