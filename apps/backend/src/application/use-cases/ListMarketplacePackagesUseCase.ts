import { prisma } from '../../infrastructure/database/prisma';

export interface ListMarketplacePackagesFilters {
  examTypeId?: string;
  limit?: number;
}

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
  ratingAvg: number | null;
  ratingCount: number;
  saleCount: number;
  tags: string[];
}

export class ListMarketplacePackagesUseCase {
  async execute(filters?: ListMarketplacePackagesFilters): Promise<{ items: MarketplacePackageItem[] }> {
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 20));

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
        educator: { select: { id: true, username: true } },
        tests: {
          where: { deletedAt: null },
          select: {
            id: true,
            examTypeId: true,
            examType: { select: { id: true, name: true } },
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (packages.length === 0) return { items: [] };

    // Tüm test ID'lerini topla — tek sorguda rating ve sale aggregation
    const allTestIds: string[] = packages.flatMap((pkg: any) => pkg.tests.map((t: any) => t.id));
    const packageIds: string[] = packages.map((pkg: any) => pkg.id);

    // Rating aggregation: testId bazında group by
    const ratingRows: any[] = allTestIds.length
      ? await prisma.review.groupBy({
          by: ['testId'],
          where: { testId: { in: allTestIds } },
          _avg: { testRating: true },
          _count: { _all: true },
        } as any)
      : [];

    // Sale aggregation: packageId bazında
    const saleRows: any[] = packageIds.length
      ? await (prisma.purchase as any).groupBy({
          by: ['packageId'],
          where: { packageId: { in: packageIds }, status: 'ACTIVE' },
          _count: { _all: true },
        })
      : [];

    // testId -> { avg, count } haritası
    const ratingByTestId = new Map<string, { avg: number; count: number }>();
    for (const r of ratingRows) {
      ratingByTestId.set(r.testId, { avg: r._avg.testRating ?? 0, count: r._count._all ?? 0 });
    }

    // packageId -> saleCount haritası
    const saleByPackageId = new Map<string, number>();
    for (const s of saleRows) {
      if (s.packageId) saleByPackageId.set(s.packageId, s._count._all ?? 0);
    }

    const items: MarketplacePackageItem[] = packages.map((pkg: any) => {
      const tests: any[] = pkg.tests ?? [];
      const questionCount = tests.reduce((sum: number, t: any) => sum + (t._count?.questions ?? 0), 0);
      const firstTestWithType = tests.find((t: any) => t.examTypeId != null);
      const examTypeId: string | null = firstTestWithType?.examTypeId ?? null;
      const examTypeName: string | null = firstTestWithType?.examType?.name ?? null;

      // Package rating: tüm testlerin ağırlıklı ortalaması
      let ratingSum = 0;
      let ratingCnt = 0;
      for (const t of tests) {
        const r = ratingByTestId.get(t.id);
        if (r && r.count) {
          ratingSum += r.avg * r.count;
          ratingCnt += r.count;
        }
      }

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
        ratingAvg: ratingCnt > 0 ? ratingSum / ratingCnt : null,
        ratingCount: ratingCnt,
        saleCount: saleByPackageId.get(pkg.id) ?? 0,
        tags: [],
      };
    });

    return { items };
  }
}
