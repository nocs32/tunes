import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, type Discovery, isLoggedOut, type Run, unwrap } from '@/api.ts';

// A failed run remembers what was tried, so Retry repeats exactly that (D18).
export type RunError = { message: string; refused: boolean; retry: () => void };

type Busy = 'new' | 'refine' | null;

export type RunsState = {
  run: Run | null;
  busy: Busy;
  error: RunError | null;
  start: (mood: string, discovery: Discovery) => void;
  refine: (note: string) => void;
  setRemoved: (position: number, removed: boolean) => void;
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

  const setRemoved = (position: number, removed: boolean): void => {
    if (!run) return;

    setRun({ ...run, tracks: run.tracks.map((item) => (item.position === position ? { ...item, removed } : item)) });
    api.runs[':id'].tracks[':position'].$put({ param: { id: String(run.id), position: String(position) }, json: { removed } });
  };

  return { run, busy, error, start, refine, setRemoved };
};
