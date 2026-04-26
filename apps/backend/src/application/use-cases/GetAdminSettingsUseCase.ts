import type { AdminSettings } from '../../domain/types';

/** FR-Y-06: Admin ayarlarını okuma */
export class GetAdminSettingsUseCase {
  async execute(prisma: { adminSettings: { findUnique: (args: any) => Promise<any> } }): Promise<AdminSettings> {
    const row = await prisma.adminSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      // Satır henüz oluşturulmamışsa tüm özellikler açık döner (fail-open)
      return { commissionPercent: 20, vatPercent: 18, purchasesEnabled: true, packageCreationEnabled: true, testPublishingEnabled: true, testAttemptsEnabled: true, adPurchasesEnabled: true };
    }
    return {
      commissionPercent: row.commissionPercent ?? 20,
      vatPercent: row.vatPercent ?? 18,
      purchasesEnabled: row.purchasesEnabled ?? true,
      packageCreationEnabled: row.packageCreationEnabled ?? true,
      testPublishingEnabled: row.testPublishingEnabled ?? true,
      testAttemptsEnabled: row.testAttemptsEnabled ?? true,
      // Reklam satın alma kill-switch'i — varsayılan açık
      adPurchasesEnabled: (row as any).adPurchasesEnabled ?? true,
    };
  }
}
