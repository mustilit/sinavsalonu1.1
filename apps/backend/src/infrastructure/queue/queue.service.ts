import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './queue.constants';
import { EmailJob } from './queue.types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export class QueueService {
  private queue: Queue;
  constructor() {
    this.queue = new Queue(EMAIL_QUEUE, { connection: { url: REDIS_URL } as any });
  }

  async enqueueEmail(job: EmailJob, opts?: any) {
    return this.queue.add(
      'send-email',
      job as any,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
        ...opts,
      }
    );
  }

  async enqueueJob(queueName: string, jobName: string, data: any, opts?: any) {
    const q = new Queue(queueName, { connection: { url: REDIS_URL } as any });
    return q.add(jobName, data, opts ?? { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true });
  }

  async enqueueBulkEmails(jobs: EmailJob[]) {
    return Promise.all(jobs.map((j) => this.enqueueEmail(j)));
  }
}

