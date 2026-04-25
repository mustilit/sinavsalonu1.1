import { IExamRepository } from '../../domain/interfaces/IExamRepository';

/** Test paketini ID ile getirir; sorular ve seçenekler dahil. */
export class GetTestUseCase {
  constructor(private readonly examRepository: IExamRepository) {}

  async execute(id: string) {
    return this.examRepository.findById(id);
  }
}

