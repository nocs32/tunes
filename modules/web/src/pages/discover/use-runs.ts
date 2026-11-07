import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, type Discovery, isLoggedOut, type Run, type RunTrack, unwrap } from '@/api.ts';

// A failed run remembers what was tried, so Retry repeats exactly that (D18).
export type RunError = { message: string; refused: boolean; retry: () => void };

type Busy = 'new' | 'refine' | 'rediscover' | null;

export type RunsState = {
  run: Run | null;
  busy: Busy;
  error: RunError | null;
  start: (mood: string, discovery: Discovery, seedTrackIds?: string[]) => void;
  moreLike: (trackIds: string[]) => void;
  rediscover: (mood: string) => void;
  refine: (note: string) => void;
  open: (runId: number) => void;
} & TrackEdits;

export type TrackEdits = {
  setRemoved: (position: number, removed: boolean) => void;
  setVote: (position: number, vote: RunTrack['vote']) => void;
  setSent: (playlist: NonNullable<Run['playlist']>) => void;
};

// Changes to one run's songs: shown at once, saved in the background.
const useTrackEdits = (run: Run | null, setRun: (run: Run) => void): TrackEdits => {
  const update = (position: number, change: Partial<RunTrack>): void => {
    if (run) setRun({ ...run, tracks: run.tracks.map((item) => (item.position === position ? { ...item, ...change } : item)) });
  };

  const params = (position: number): { id: string; position: string } => ({ id: String(run?.id), position: String(position) });

  return {
    setRemoved: (position, removed) => {
      update(position, { removed });
      api.runs[':id'].tracks[':position'].$put({ param: params(position), json: { removed } });
    },
    setVote: (position, vote) => {
      update(position, { vote });
      api.runs[':id'].tracks[':position'].vote.$put({ param: params(position), json: { vote } });
    },
    setSent: (playlist) => {
      if (run) setRun({ ...run, playlist });
    },
  };
};

type Requests = { busy: Busy; error: RunError | null; go: (kind: NonNullable<Busy>, request: () => Promise<Run>) => void };

const pollMs = 3000;

// A run is a background job on the server (Cloudflare cuts requests off at 100 s, runs take ~90):
// ask every few seconds until it's done or failed.
const waitForRun = async (started: Promise<{ jobId: string }>): Promise<Run> => {
  const { jobId } = await started;

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));

    const job = await unwrap(api.runs.jobs[':jobId'].$get({ param: { jobId } }));

    if (job.status === 'done') return job.result;

    if (job.status === 'failed') throw new ApiError(job.error.error, job.error.message);
  }
};

// Runs one request at a time, with the busy flag, the error and its Retry.
const useRunRequests = (setRun: (run: Run) => void, onLoggedOut: (message: string | null) => void): Requests => {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<RunError | null>(null);

  const go = useCallback(
    (kind: NonNullable<Busy>, request: () => Promise<Run>) => {
      const attempt = (): void => {
        setBusy(kind);
        setError(null);

        request()
          .then(setRun)
          .catch((reason: unknown) => {
            if (isLoggedOut(reason)) return onLoggedOut(reason.code === 'relogin' ? reason.message : null);

            const refused = reason instanceof ApiError && reason.code === 'claude_refused';

            setError({ message: reason instanceof Error ? reason.message : String(reason), refused, retry: attempt });
          })
          .finally(() => setBusy(null));
      };

      attempt();
    },
    [setRun, onLoggedOut],
  );

  return { busy, error, go };
};

export const useRuns = (onLoggedOut: (message: string | null) => void): RunsState => {
  const [run, setRun] = useState<Run | null>(null);
  const { busy, error, go } = useRunRequests(setRun, onLoggedOut);

  useEffect(() => {
    unwrap(api.runs.latest.$get())
      .then((latest) => setRun(latest.run))
      .catch(() => undefined);
  }, []);

  const start = (mood: string, discovery: Discovery, seedTrackIds?: string[]): void =>
    go('new', () => waitForRun(unwrap(api.runs.$post({ json: { mood, discovery, seedTrackIds } }))));

  // A new mix around songs you picked (one with ✨, or the crate), at the shown mix's discovery level.
  // After a Rediscover list, Mixed.
  const moreLike = (trackIds: string[]): void => start('', run && run.discovery !== 'rediscover' ? run.discovery : 'mixed', trackIds);

  const rediscover = (mood: string): void => go('rediscover', () => waitForRun(unwrap(api.runs.rediscover.$post({ json: { mood } }))));

  const refine = (note: string): void => {
    if (run) go('refine', () => waitForRun(unwrap(api.runs[':id'].refine.$post({ param: { id: String(run.id) }, json: { note } }))));
  };

  const open = (runId: number): void => {
    unwrap(api.runs[':id'].$get({ param: { id: String(runId) } }))
      .then(setRun)
      .catch(() => undefined);
  };

  return { run, busy, error, start, moreLike, rediscover, refine, open, ...useTrackEdits(run, setRun) };
};
