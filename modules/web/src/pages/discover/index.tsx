import { type ReactElement, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { RunForm } from './run-form.tsx';
import { RunResult } from './run-result.tsx';
import { type RunError, useRuns } from './use-runs.ts';

// A run takes a minute or two: Claude thinks, then every song is looked up on Spotify.
function Working({ refining }: { refining: boolean }): ReactElement {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Alert role="status">
      <AlertTitle>{refining ? 'Claude is reworking the list' : 'Claude is picking songs'}</AlertTitle>
      <AlertDescription>
        Then each one is looked up on Spotify, so nothing made up gets through. This usually takes a minute or two, and
        it’s been <span className="tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>.
      </AlertDescription>
    </Alert>
  );
}

function Failed({ error }: { error: RunError }): ReactElement {
  return (
    <Alert variant="destructive">
      <AlertTitle>{error.refused ? 'Claude declined this run' : 'The run didn’t finish'}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{error.message}</span>
        <Button variant="outline" size="sm" onClick={error.retry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function DiscoverPanel({ onLoggedOut }: { onLoggedOut: (message: string | null) => void }): ReactElement {
  const { run, busy, error, start, refine, setRemoved } = useRuns(onLoggedOut);

  return (
    <div className="flex flex-col gap-10">
      <RunForm busy={busy !== null} initialDiscovery={run?.discovery ?? 'mixed'} onStart={start} />
      {busy && <Working refining={busy === 'refine'} />}
      {error && !busy && <Failed error={error} />}
      {run && <RunResult run={run} busy={busy !== null} onRefine={refine} onRemove={setRemoved} />}
    </div>
  );
}
