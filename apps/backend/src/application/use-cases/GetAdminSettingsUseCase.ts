import { Injectable } from '@nestjs/common';
import type { AdminSettings } from '../../domain/types';

/** FR-Y-06: Admin ayarlarını okuma */
@Injectable()
export class GetAdminSettingsUseCase {
  async execute(prisma: { adminSettings: { findUnique: (args: any) => Promise<any> } }): Promise<AdminSettings> {
    const row = await prisma.adminSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      return {
        commissionPercent: 20,
        vatPercent: 18,
        purchasesEnabled: true,
        packageCreationEnabled: true,
        testPublishingEnabled: true,
        testAttemptsEnabled: true,
        adPurchasesEnabled: true,
        minPackagePriceCents: 100,
      };
    }
    return {
      commissionPercent: row.commissionPercent ?? 20,
      vatPercent: row.vatPercent ?? 18,
      purchasesEnabled: row.purchasesEnabled ?? true,
      packageCreationEnabled: row.packageCreationEnabled ?? true,
      testPublishingEnabled: row.testPublishingEnabled ?? true,
      testAttemptsEnabled: row.testAttemptsEnabled ?? true,
      adPurchasesEnabled: (row as any).adPurchasesEnabled ?? true,
      minPackagePriceCents: (row as any).minPackagePriceCents ?? 100,
    };
  }
}
