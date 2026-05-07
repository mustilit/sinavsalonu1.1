import { ITestPackageRepository } from '../../domain/interfaces/ITestPackageRepository';

export class ListEducatorPackagesUseCase {
  constructor(private readonly repo: ITestPackageRepository) {}

  async execute(educatorId: string) {
    return this.repo.findByEducatorId(educatorId);
  }
}
