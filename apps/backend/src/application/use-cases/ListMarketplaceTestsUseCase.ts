import { IExamRepository } from '../../domain/interfaces/IExamRepository';
import { ReviewAggregationService } from '../services/ReviewAggregationService';

type Filters = {
  examTypeId?: string;
  isTimed?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  page?: number;
  limit?: number;
  sortBy?: 'NEWEST' | 'PRICE' | 'RATING' | 'POPULARITY';
  sortDir?: 'asc' | 'desc';
  minRating?: number;
};

export class ListMarketplaceTestsUseCase {
  private agg = new ReviewAggregationService();
  constructor(private readonly examRepository: IExamRepository) {}

  async execute(filters?: Filters) {
    const limit = Math.min(50, Math.max(1, filters?.limit ?? 20));
    const page = Math.max(1, filters?.page ?? 1);

    const sortBy = filters?.sortBy ?? 'NEWEST';
    const sortDir = filters?.sortDir ?? 'desc';

    // For RATING sort or minRating filter, fetch larger pool then process in-memory
    const fetchLimit = 200; // cap
    const repoSortMap: any = {
      NEWEST: 'publishedAt',
      PRICE: 'price',
      POPULARITY: 'publishedAt',
    };

    const repoSort = sortBy === 'RATING' ? 'publishedAt' : repoSortMap[sortBy] ?? 'publishedAt';

    const res = await this.examRepository.findPublished({
      examTypeId: filters?.examTypeId,
      isTimed: filters?.isTimed,
      minPriceCents: filters?.minPriceCents,
      maxPriceCents: filters?.maxPriceCents,
      page: 1,
      limit: fetchLimit,
      sortBy: repoSort as any,
      order: sortDir as any,
    });

    let items = res.items;

    // enrich with rating aggregates
    const ids = items.map((t) => t.id);
    const aggs = await this.agg.getAggregatesForTestIds(ids);
    const enriched = items.map((t) => ({ ...t, ratingAvg: aggs[t.id]?.avg ?? null, ratingCount: aggs[t.id]?.count ?? 0 }));

    // apply minRating filter if provided
    let filtered = enriched;
    if (typeof filters?.minRating === 'number') {
      filtered = enriched.filter((t) => (t.ratingAvg ?? 0) >= (filters!.minRating ?? 0));
    }

    // sort in-memory when sorting by RATING, otherwise use repo ordering
    if (sortBy === 'RATING') {
      filtered.sort((a: any, b: any) => {
        const ra = a.ratingAvg ?? 0;
        const rb = b.ratingAvg ?? 0;
        if (ra === rb) {
          const ca = a.ratingCount ?? 0;
          const cb = b.ratingCount ?? 0;
          if (ca === cb) {
            // tie-break by publishedAt desc
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          }
          return cb - ca;
        }
        return sortDir === 'asc' ? ra - rb : rb - ra;
      });
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);

    // map minimal summary
    const summaries = pageItems.map((t: any) => ({
      id: t.id,
      title: t.title,
      educatorId: t.educatorId,
      examTypeId: (t as any).examTypeId ?? null,
      priceCents: (t as any).priceCents ?? null,
      currency: (t as any).currency ?? 'TRY',
      isTimed: t.isTimed,
      questionCount: t.questionCount ?? 0,
      ratingAvg: t.ratingAvg ?? null,
      ratingCount: t.ratingCount ?? 0,
    }));

    return { items: summaries, meta: { total, page, limit } };
  }
}

