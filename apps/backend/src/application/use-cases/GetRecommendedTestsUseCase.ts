import { IFollowRepository } from '../../domain/interfaces/IFollowRepository';
import { IExamRepository } from '../../domain/interfaces/IExamRepository';
import { RedisCache } from '../../infrastructure/cache/RedisCache';

export class GetRecommendedTestsUseCase {
  private cache = new RedisCache();
  constructor(private readonly followRepo: IFollowRepository, private readonly examRepo: IExamRepository) {}

  async execute(candidateId: string, limit = 20, examTypeId?: string) {
    const educatorIds = await this.followRepo.listFollowedEducatorIds(candidateId);
    const examTypeIds = await this.followRepo.listFollowedExamTypeIds(candidateId);

    const followLimit = Math.ceil(limit * 0.6);
    const fallbackLimit = limit - followLimit;

    const cacheKey = `home:rec:${candidateId}:${examTypeId || 'all'}:v1`;
    const cached = await this.cache.get<any>(cacheKey);
    let followed: any[] = [];
    if (cached) {
      followed = cached.followed.slice(0, followLimit);
    } else {
      if (educatorIds.length || examTypeIds.length) {
        followed = await this.examRepo.listPublishedByFollowed({ educatorIds, examTypeIds, limit: followLimit, examTypeId: examTypeId ?? null });
      }
    }

    const selectedIds = new Set(followed.map((t) => t.id));
    const fallback = await this.examRepo.listPublishedFallback({ excludeIds: Array.from(selectedIds), limit: fallbackLimit, examTypeId: examTypeId ?? null });

    const combined = [...followed, ...fallback].slice(0, limit);
    // enrich with aggregates
    const testIds = combined.map((t) => t.id);
    const { ReviewAggregationService } = require('../services/ReviewAggregationService');
    const aggSvc = new ReviewAggregationService();
    const aggs = await aggSvc.getAggregatesForTestIds(testIds);
    // prefer materialized stats if present
    const statsRows: any[] = await (require('../../infrastructure/database/prisma').prisma).testStats.findMany({ where: { testId: { in: testIds } } as any });
    const statsMap: Record<string, any> = {};
    for (const s of statsRows) statsMap[s.testId] = s;

    const items = combined.map((t) => {
      const tags = [];
      if (educatorIds.includes(t.educatorId ?? '')) tags.push('FOLLOWED_EDUCATOR');
      if (examTypeIds.includes((t as any).examTypeId ?? '')) tags.push('FOLLOWED_EXAMTYPE');
      if (!tags.length) tags.push('POPULAR');
      const ratingAvg = statsMap[t.id]?.ratingAvg ?? aggs[t.id]?.avg ?? null;
      const ratingCount = statsMap[t.id]?.ratingCount ?? aggs[t.id]?.count ?? 0;
      const purchaseCount = statsMap[t.id]?.purchaseCount ?? null;
      return {
        id: t.id,
        title: t.title,
        educatorId: t.educatorId,
        examTypeId: (t as any).examTypeId ?? null,
        priceCents: (t as any).priceCents ?? null,
        currency: (t as any).currency ?? 'TRY',
        isTimed: t.isTimed,
        questionCount: t.questionCount ?? 0,
        ratingAvg,
        ratingCount,
        purchaseCount,
        tags,
      };
    });

    // cache only if we computed followed result
    if (!cached) {
      await this.cache.set(cacheKey, { followed, timestamp: Date.now() }, 120);
    }

    return { items, meta: { limit, followedBoosted: followed.length, fallbackCount: fallback.length } };
  }
}

import { IExamRepository } from '../../domain/interfaces/IExamRepository';
import { IFollowRepository } from '../../domain/interfaces/IFollowRepository';
import { RedisCache } from '../../infrastructure/cache/RedisCache';

type Summary = {
  id: string;
  title: string;
  educatorId?: string | null;
  examTypeId?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  isTimed?: boolean;
  questionCount?: number | null;
  tags?: string[];
};

export class GetRecommendedTestsUseCase {
  private cache: RedisCache;
  constructor(private readonly examRepo: IExamRepository, private readonly followRepo: IFollowRepository) {
    this.cache = new RedisCache();
  }

  async execute(candidateId: string, limit = 20, examTypeId?: string) {
    const l = Math.min(Math.max(limit, 1), 50);
    const cacheKey = `home:rec:${candidateId}:${examTypeId ?? 'all'}:v1`;
    const cached = await this.cache.get<{ items: Summary[] }>(cacheKey);
    if (cached) {
      return { items: cached.items.slice(0, l), meta: { limit: l, followedBoosted: Math.ceil(l * 0.6), fallbackCount: Math.max(0, l - Math.ceil(l * 0.6)) } };
    }

    const educatorIds = await this.followRepo.listFollowedEducatorIds(candidateId).catch(() => []);
    const examTypeIds = await this.followRepo.listFollowedExamTypeIds(candidateId).catch(() => []);

    const followedLimit = Math.ceil(l * 0.6);
    const fallbackLimit = l - followedLimit;

    let followedItems: any[] = [];
    if ((educatorIds && educatorIds.length) || (examTypeIds && examTypeIds.length)) {
      followedItems = await this.examRepo.listPublishedByFollowed({ educatorIds, examTypeIds, limit: followedLimit, examTypeId });
    }
    const excludeIds = followedItems.map((t) => t.id);
    const fallbackItems = await this.examRepo.listPublishedFallback({ excludeIds, limit: fallbackLimit, examTypeId });
    const combined = [...followedItems, ...fallbackItems];
    // dedupe by id, preserving order
    const seen = new Set<string>();
    const deduped = [];
    for (const t of combined) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      deduped.push(t);
    }

    const items: Summary[] = deduped.map((t) => ({
      id: t.id,
      title: t.title,
      educatorId: t.educatorId,
      examTypeId: (t as any).examTypeId ?? null,
      priceCents: (t as any).priceCents ?? null,
      currency: (t as any).currency ?? 'TRY',
      isTimed: t.isTimed,
      questionCount: t.questionCount ?? null,
      tags: [
        ...(educatorIds && educatorIds.includes(t.educatorId ?? '') ? ['FOLLOWED_EDUCATOR'] : []),
        ...(examTypeIds && examTypeIds.includes((t as any).examTypeId ?? '') ? ['FOLLOWED_EXAMTYPE'] : []),
        ...(followedItems.find((f: any) => f.id === t.id) ? [] : ['POPULAR']),
      ],
    }));

    await this.cache.set(cacheKey, { items }, 120);
    return { items, meta: { limit: l, followedBoosted: followedItems.length, fallbackCount: fallbackItems.length } };
  }
}

