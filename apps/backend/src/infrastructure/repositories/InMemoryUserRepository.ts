import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';

/**
 * In-memory User Repository
 * Unique constraint: email ve username benzersiz olmalı
 */
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private usernameIndex: Map<string, string> = new Map();

  async save(user: User): Promise<User> {
    // Unique constraint: email kontrolü
    const existingByEmail = await this.findByEmail(user.email);
    if (existingByEmail && existingByEmail.id !== user.id) {
      throw new Error('DUPLICATE_EMAIL');
    }

    // Unique constraint: username kontrolü
    const existingByUsername = await this.findByUsername(user.username);
    if (existingByUsername && existingByUsername.id !== user.id) {
      throw new Error('DUPLICATE_USERNAME');
    }

    // Ensure status/metadata defaults for compatibility with new schema
    const toSave: User = {
      ...user,
      status: user.status ?? 'ACTIVE',
      metadata: user.metadata ?? {},
    };

    this.users.set(user.id, toSave);
    this.emailIndex.set(user.email.toLowerCase(), user.id);
    this.usernameIndex.set(user.username.toLowerCase(), user.id);

    return toSave;
  }

  async findByEmail(email: string): Promise<User | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    return id ? this.users.get(id) ?? null : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const id = this.usernameIndex.get(username.toLowerCase());
    return id ? this.users.get(id) ?? null : null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
}
