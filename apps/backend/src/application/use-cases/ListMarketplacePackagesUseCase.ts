import { prisma } from '../../infrastructure/database/prisma';
import { AppError } from '../errors/AppError';

/** Marketplace paket listesi için filtre parametreleri. */
export interface ListMarketplacePackagesFilters {
  examTypeId?: string;
  limit?: number;
}

/** Marketplace paket listesi — her item için dönüş şekli. */
export interface MarketplacePackageItem {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  difficulty: string;
  publishedAt: string;
  educatorId: string | null;
  educatorUsername: string | null;
  examTypeId: string | null;
  examTypeName: string | null;
  questionCount: number;
  testCount: number;
}

/**
 * Marketplace'te yayınlı test paketlerini listeler.
 * test_packages tablosu tek kaynak; exam_tests yalnızca aggregation için kullanılır.
 */
export class ListMarketplacePackagesUseCase {
  /**
   * publishedAt IS NOT NULL olan paketleri döner.
   * Opsiyonel examTypeId filtresi bağlı testlerin examTypeId'sine göre filtreler.
   */
  async execute(filters?: ListMarketplacePackagesFilters): Promise<{ items: MarketplacePackageItem[] }> {
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));

    // Bağlı testlerin examTypeId'si üzerinden filtreleme için where koşulu
    const testsWhereForFilter = filters?.examTypeId
      ? { some: { examTypeId: filters.examTypeId, deletedAt: null } }
      : undefined;

    const packages = await (prisma.testPackage as any).findMany({
      where: {
        publishedAt: { not: null },
        ...(testsWhereForFilter && { tests: testsWhereForFilter }),
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        educator: {
          select: { id: true, username: true },
        },
        tests: {
          where: { deletedAt: null },
          select: {
            id: true,
            examTypeId: true,
            examType: {
              select: { id: true, name: true },
            },
            _count: {
              select: { questions: true },
            },
          },
        },
      },
    });

    const items: MarketplacePackageItem[] = packages.map((pkg: any) => {
      const tests: any[] = pkg.tests ?? [];

      // Toplam soru sayısı: bağlı tüm testlerin question count toplamı
      const questionCount = tests.reduce((sum: number, t: any) => sum + (t._count?.questions ?? 0), 0);

      // examType bilgisi: ilk bulunan testin examType'ı kullanılır
      const firstTestWithType = tests.find((t: any) => t.examTypeId != null);
      const examTypeId: string | null = firstTestWithType?.examTypeId ?? null;
      const examTypeName: string | null = firstTestWithType?.examType?.name ?? null;

      return {
        id: pkg.id,
        title: pkg.title,
        description: pkg.description ?? null,
        priceCents: pkg.priceCents,
        difficulty: pkg.difficulty ?? 'medium',
        publishedAt: (pkg.publishedAt as Date).toISOString(),
        educatorId: pkg.educatorId ?? null,
        educatorUsername: pkg.educator?.username ?? null,
        examTypeId,
        examTypeName,
        questionCount,
        testCount: tests.length,
      };
    });

    return { items };
  }
}
