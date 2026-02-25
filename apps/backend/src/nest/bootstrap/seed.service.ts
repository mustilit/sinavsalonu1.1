import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../modules/prisma/prisma.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      if (process.env.NODE_ENV === 'production') {
        console.log('Seed skipped: production environment');
        return;
      }

      const count = await this.prisma.examTest.count();
      if (count > 0) {
        console.log('Seed: tests already exist — checking for tests without questions');
        // find tests that have no questions and seed them (idempotent)
        const tests = await this.prisma.client.examTest.findMany({ include: { questions: true } });
        for (const t of tests) {
          if (!t.questions || t.questions.length === 0) {
            console.log(`Seeding missing questions for test ${t.id}`);
            for (let i = 1; i <= 5; i++) {
              await this.prisma.client.examQuestion.create({
                data: {
                  testId: t.id,
                  content: `Seed Question ${i}`,
                  order: i,
                  options: {
                    create: [
                      { content: 'Option A', isCorrect: false },
                      { content: 'Option B', isCorrect: true },
                    ],
                  },
                },
              });
            }
          }
        }
        console.log('Seed check complete');
        return;
      }

      console.log('Running DEV seed...');
      const created = await this.prisma.examTest.create({
        data: {
          title: 'Seed Demo Test',
          isTimed: false,
          price: 49.99,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      // Create 5 questions with 2 options each (one correct)
      for (let i = 1; i <= 5; i++) {
        await this.prisma.client.examQuestion.create({
          data: {
            testId: created.id,
            content: `Seed Question ${i}`,
            order: i,
            options: {
              create: [
                { content: 'Option A', isCorrect: false },
                { content: 'Option B', isCorrect: true },
              ],
            },
          },
        });
      }

      console.log('Seed test created with questions');
    } catch (e) {
      console.error('Seed error', e);
    }
  }
}

