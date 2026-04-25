import type { AdminSettings } from '../../domain/types';

/** FR-Y-06: Komisyon + KDV ayarı */
export class UpdateAdminSettingsUseCase {
  async execute(
    prisma: { adminSettings: { upsert: (args: any) => Promise<any> } },
    input: { commissionPercent?: number; vatPercent?: number; purchasesEnabled?: boolean; packageCreationEnabled?: boolean; testPublishingEnabled?: boolean; testAttemptsEnabled?: boolean },
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
      },
      update: {
        ...(input.commissionPercent !== undefined && { commissionPercent: input.commissionPercent }),
        ...(input.vatPercent !== undefined && { vatPercent: input.vatPercent }),
        ...(input.purchasesEnabled !== undefined && { purchasesEnabled: input.purchasesEnabled }),
        ...(input.packageCreationEnabled !== undefined && { packageCreationEnabled: input.packageCreationEnabled }),
        ...(input.testPublishingEnabled !== undefined && { testPublishingEnabled: input.testPublishingEnabled }),
        ...(input.testAttemptsEnabled !== undefined && { testAttemptsEnabled: input.testAttemptsEnabled }),
      },
    });
    return {
      commissionPercent: row.commissionPercent,
      vatPercent: row.vatPercent,
      purchasesEnabled: row.purchasesEnabled,
      packageCreationEnabled: row.packageCreationEnabled ?? true,
      testPublishingEnabled: row.testPublishingEnabled ?? true,
      testAttemptsEnabled: row.testAttemptsEnabled ?? true,
    };
  }
}
