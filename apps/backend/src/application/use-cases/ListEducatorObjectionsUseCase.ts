import { IObjectionRepository, EnrichedObjection } from '../../domain/interfaces/IObjectionRepository';

export class ListEducatorObjectionsUseCase {
  constructor(private readonly objectionRepo: IObjectionRepository) {}

  async execute(educatorId: string, filters?: { status?: string }): Promise<EnrichedObjection[]> {
    return this.objectionRepo.listByEducator(educatorId, filters);
  }
}
