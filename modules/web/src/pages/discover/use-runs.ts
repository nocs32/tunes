import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, type Discovery, isLoggedOut, type Run, type RunTrack, unwrap } from '@/api.ts';

// A failed run remembers what was tried, so Retry repeats exactly that (D18).
export type RunError = { message: string; refused: boolean; retry: () => void };

type Busy = 'new' | 'refine' | null;

export type RunsState = {
  run: Run | null;
  busy: Busy;
  error: RunError | null;
  start: (mood: string, discovery: Discovery) => void;
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

type Requests = { busy: Busy; error: RunError | null; go: (kind: 'new' | 'refine', request: () => Promise<Run>) => void };

// Runs one request at a time, with the busy flag, the error and its Retry.
const useRunRequests = (setRun: (run: Run) => void, onLoggedOut: (message: string | null) => void): Requests => {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<RunError | null>(null);

  const go = useCallback(
    (kind: 'new' | 'refine', request: () => Promise<Run>) => {
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

  const start = (mood: string, discovery: Discovery): void => go('new', () => unwrap(api.runs.$post({ json: { mood, discovery } })));

  const refine = (note: string): void => {
    if (run) go('refine', () => unwrap(api.runs[':id'].refine.$post({ param: { id: String(run.id) }, json: { note } })));
  };

  const open = (runId: number): void => {
    unwrap(api.runs[':id'].$get({ param: { id: String(runId) } }))
      .then(setRun)
      .catch(() => undefined);
  };

  return { run, busy, error, start, refine, open, ...useTrackEdits(run, setRun) };
};
