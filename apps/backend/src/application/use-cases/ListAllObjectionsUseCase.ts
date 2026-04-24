import { IObjectionRepository, EnrichedObjection } from '../../domain/interfaces/IObjectionRepository';

export class ListAllObjectionsUseCase {
  constructor(private readonly objectionRepo: IObjectionRepository) {}

  async execute(filters?: { status?: string; from?: Date; to?: Date }): Promise<EnrichedObjection[]> {
    return this.objectionRepo.listAll(filters);
  }
}
