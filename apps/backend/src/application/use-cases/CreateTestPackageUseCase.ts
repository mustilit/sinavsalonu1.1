import { AppError } from '../errors/AppError';
import { prisma } from '../../infrastructure/database/prisma';
import { ITestPackageRepository } from '../../domain/interfaces/ITestPackageRepository';
import { getDefaultTenantId } from '../../common/tenant';

export class CreateTestPackageUseCase {
  constructor(private readonly repo: ITestPackageRepository) {}

  async execute(educatorId: string, input: {
    title: string;
    description?: string | null;
    priceCents: number;
  }) {
    // Kill-switch kontrolü
    const settings = await prisma.adminSettings.findFirst({ where: { id: 1 } });
    if (settings && settings.packageCreationEnabled === false) {
      throw new AppError('PACKAGE_CREATION_DISABLED', 'Paket oluşturma geçici olarak durdurulmuştur', 503);
    }

    if (!input.title || input.title.trim().length === 0) {
      throw new AppError('INVALID_TITLE', 'Paket başlığı boş olamaz', 400);
    }

    if (input.priceCents < 0) {
      throw new AppError('INVALID_PRICE', 'Fiyat negatif olamaz', 400);
    }

    // Educator'ın tenant'ını bul
    const educator = await prisma.user.findUnique({ where: { id: educatorId }, select: { tenantId: true } });
    const tenantId = educator?.tenantId ?? getDefaultTenantId();

    return this.repo.create({
      tenantId,
      educatorId,
      title: input.title.trim(),
      description: input.description ?? null,
      priceCents: input.priceCents,
    });
  }
}
