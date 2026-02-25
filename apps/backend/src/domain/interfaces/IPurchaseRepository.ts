export interface IPurchaseRepository {
  hasPurchase(testId: string, candidateId: string): Promise<boolean>;
}

