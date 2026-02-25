import { Injectable, Inject } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService {
  constructor(@Inject('PRISMA') public readonly client: PrismaClient) {}

  // convenience getters
  get examTest() {
    return this.client.examTest;
  }

  get auditLog() {
    return this.client.auditLog;
  }

  get purchase() {
    return this.client.purchase;
  }

  get testAttempt() {
    return this.client.testAttempt;
  }
}

