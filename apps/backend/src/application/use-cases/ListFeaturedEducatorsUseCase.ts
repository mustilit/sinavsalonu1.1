import type { PrismaClient } from '@prisma/client';

export type FeaturedEducator = {
  id: string;
  username: string;
  testCount: number;
  saleCount: number;
  ratingAvg: number | null;
};

export class ListFeaturedEducatorsUseCase {
  async execute(prisma: PrismaClient, limit = 6, examTypeIds?: string[]): Promise<FeaturedEducator[]> {
    const capped = Math.min(20, Math.max(1, limit));

    let educatorIds: string[] = [];

    // Phase 1: personalized — educators whose tests belong to the requested exam types
    if (examTypeIds && examTypeIds.length > 0) {
      const safeIds = examTypeIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
      if (safeIds.length > 0) {
        const preferredLimit = Math.ceil(capped * 0.7);
        const preferredRows = await prisma.$queryRaw<{ educator_id: string; cnt: number }[]>`
          SELECT t."educatorId" AS educator_id, COUNT(p.id)::int AS cnt
          FROM purchases p
          JOIN exam_tests t ON p."testId" = t.id
          WHERE t."educatorId" IS NOT NULL
            AND t."publishedAt" IS NOT NULL
            AND t."examTypeId" = ANY(${safeIds}::uuid[])
          GROUP BY t."educatorId"
          ORDER BY cnt DESC
          LIMIT ${preferredLimit}
        `;
        educatorIds = preferredRows.map((r) => r.educator_id);
      }
    }

    // Phase 2: fill remaining slots with global bestsellers
    if (educatorIds.length < capped) {
      const remaining = capped - educatorIds.length;
      const excludeIds = educatorIds;
      const globalRows = await prisma.$queryRaw<{ educator_id: string; cnt: number }[]>`
        SELECT t."educatorId" AS educator_id, COUNT(p.id)::int AS cnt
        FROM purchases p
        JOIN exam_tests t ON p."testId" = t.id
        WHERE t."educatorId" IS NOT NULL
          AND t."publishedAt" IS NOT NULL
          AND (${excludeIds.length} = 0 OR t."educatorId" != ALL(${excludeIds}::uuid[]))
        GROUP BY t."educatorId"
        ORDER BY cnt DESC
        LIMIT ${remaining}
      `;
      educatorIds = [...educatorIds, ...globalRows.map((r) => r.educator_id)];
    }

    // Fallback: no purchase data at all — return active educators by creation date
    if (educatorIds.length === 0) {
      const fallback = await prisma.user.findMany({
        where: { role: 'EDUCATOR', status: 'ACTIVE' },
        take: capped,
        select: { id: true, username: true },
      });
      const testCounts = await prisma.examTest.groupBy({
        by: ['educatorId'],
        where: { educatorId: { in: fallback.map((u) => u.id) }, publishedAt: { not: null } },
        _count: { id: true },
      });
      const byEducator = Object.fromEntries(testCounts.map((t) => [t.educatorId!, t._count.id]));
      return fallback.map((u) => ({
        id: u.id,
        username: u.username,
        testCount: byEducator[u.id] ?? 0,
        saleCount: 0,
        ratingAvg: null as number | null,
      }));
    }

    // Resolve user data for collected educator IDs
    const users = await prisma.user.findMany({
      where: { id: { in: educatorIds }, role: 'EDUCATOR' },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const testCounts = await prisma.examTest.groupBy({
      by: ['educatorId'],
      where: { educatorId: { in: educatorIds }, publishedAt: { not: null } },
      _count: { id: true },
    });
    const testCountMap = new Map(testCounts.map((t) => [t.educatorId!, t._count.id]));

    // Build sale count map from all purchases (not just typed ones) so totals are accurate
    const allSales = await prisma.$queryRaw<{ educator_id: string; cnt: number }[]>`
      SELECT t."educatorId" AS educator_id, COUNT(p.id)::int AS cnt
      FROM purchases p
      JOIN exam_tests t ON p."testId" = t.id
      WHERE t."educatorId" = ANY(${educatorIds}::uuid[])
        AND t."publishedAt" IS NOT NULL
      GROUP BY t."educatorId"
    `;
    const saleMap = new Map(allSales.map((r) => [r.educator_id, r.cnt]));

    const ratingRows = await prisma.review.groupBy({
      by: ['educatorId'],
      where: { educatorId: { in: educatorIds }, educatorRating: { not: null } },
      _avg: { educatorRating: true },
      _count: { id: true },
    });
    const ratingMap = new Map(ratingRows.map((r) => [r.educatorId, r._avg.educatorRating ?? null]));

    return educatorIds
      .filter((id) => userMap.has(id))
      .map((id) => ({
        id,
        username: userMap.get(id)!.username,
        testCount: testCountMap.get(id) ?? 0,
        saleCount: saleMap.get(id) ?? 0,
        ratingAvg: ratingMap.get(id) ?? null,
      }));
  }
}
