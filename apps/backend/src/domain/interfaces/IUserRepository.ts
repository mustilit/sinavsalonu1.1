export interface IUserRepository {
  updateLastLoginAt(userId: string, date: Date): Promise<void>;
  listInactiveUsersWithOpenAttempts(days: number): Promise<
    { userId: string; attemptId: string }[]
  >;
}

import { User } from '../entities/User';

export interface IUserRepository {
  save(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
