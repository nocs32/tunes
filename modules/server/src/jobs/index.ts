import { randomToken } from '../auth/crypto.ts';
import { describeError, type ErrorBody } from '../errors.ts';

// Runs take 75–95 s, and Cloudflare (in front of the Pi) gives up on any request that hasn't
// answered within 100 s. So a run is started as a job: the request returns at once with its id,
// and the page asks GET /api/jobs/:id every few seconds until it's done.
// Jobs live in memory: a server restart forgets them, and the page says to retry.

export type JobState<T> =
  | { status: 'running' }
  | { status: 'done'; result: T }
  | { status: 'failed'; httpStatus: number; error: ErrorBody };

type Job = { userId: string; startedAt: number; state: JobState<unknown> };

const jobs = new Map<string, Job>();

// Finished jobs are kept for an hour, so a page that was asleep can still pick up the result.
const keepMs = 60 * 60 * 1000;

const forgetOld = (): void => {
  const cutoff = Date.now() - keepMs;

  jobs.forEach((job, id) => {
    if (job.startedAt < cutoff) jobs.delete(id);
  });
};

export const startJob = <T>(userId: string, work: () => Promise<T>): string => {
  forgetOld();

  const id = randomToken(12);
  const job: Job = { userId, startedAt: Date.now(), state: { status: 'running' } };

  jobs.set(id, job);

  work()
    .then((result) => {
      job.state = { status: 'done', result };
    })
    .catch((error: unknown) => {
      const [httpStatus, body] = describeError(error instanceof Error ? error : new Error(String(error)));

      if (httpStatus >= 500) console.error(error);

      job.state = { status: 'failed', httpStatus, error: body };
    });

  return id;
};

// Only the person who started it can read a job.
export const getJob = <T>(id: string, userId: string): JobState<T> | undefined => {
  const job = jobs.get(id);

  return job && job.userId === userId ? (job.state as JobState<T>) : undefined;
};
