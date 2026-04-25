import { Injectable, Inject } from '@nestjs/common';
import { ITopicRepository } from '../../domain/interfaces/ITopicRepository';
import { TOPIC_REPO } from '../constants';

/** UUID doğrulama regex'i — examTypeId formatı bu kuralla kontrol edilir. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Belirli bir sınav türüne ait konuları listeler.
 * examTypeId UUID formatında olmalıdır; geçersizse 400 hatası fırlatılır.
 */
@Injectable()
export class ListTopicsByExamTypeUseCase {
  constructor(@Inject(TOPIC_REPO) private readonly repo: ITopicRepository) {}

  /**
   * Sınav türüne göre konuları getirir.
   * @param examTypeId - Sınav türü ID'si (UUID formatında olmalı).
   * @param activeOnly - Sadece aktif konular dönsün mü? Varsayılan: true.
   */
  async execute(examTypeId: string, activeOnly = true) {
    // examTypeId boş veya UUID formatına uymuyorsa erken hata döndür
    if (!examTypeId || !UUID_REGEX.test(examTypeId)) {
      const err: any = new Error('Invalid examTypeId');
      err.status = 400;
      err.code = 'INVALID_UUID';
      throw err;
    }
    return this.repo.listByExamType(examTypeId, activeOnly);
  }
}
