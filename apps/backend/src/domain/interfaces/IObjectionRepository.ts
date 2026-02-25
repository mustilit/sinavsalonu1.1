export interface IObjectionRepository {
  findOverdueOpenObjections(days: number): Promise<{ id: string; attemptId: string; createdAt: Date }[]>;
  markEscalated(ids: string[]): Promise<number>;
  countByTestAndCandidate(testId: string, candidateId: string): Promise<number>;
}

