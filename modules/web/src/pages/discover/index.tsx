import { type ReactElement, useEffect, useState } from 'react';
import type { PlaylistMode } from '@/api.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { EarlierMixes } from './earlier-mixes.tsx';
import { RunForm } from './run-form.tsx';
import { RunResult } from './run-result.tsx';
import type { RunError, RunsState } from './use-runs.ts';

// A run takes a minute or two: Claude thinks, then every song is looked up on Spotify.
const workingTitle = { new: 'Claude is picking songs', refine: 'Claude is reworking the list', rediscover: 'Claude is picking old favourites' } as const;

function Working({ busy }: { busy: keyof typeof workingTitle }): ReactElement {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Alert role="status">
      <AlertTitle>{workingTitle[busy]}</AlertTitle>
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

type DiscoverPanelProps = { playlistMode: PlaylistMode; runs: RunsState; hasHistory: boolean };

export function DiscoverPanel({ playlistMode, runs, hasHistory }: DiscoverPanelProps): ReactElement {
  const { run, busy, error, start, rediscover, refine, open, setRemoved, setVote, setSent } = runs;

  const openRun = (runId: number): void => {
    open(runId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-10">
      <RunForm
        busy={busy !== null}
        initialDiscovery={run && run.discovery !== 'rediscover' ? run.discovery : 'mixed'}
        onStart={start}
        onRediscover={hasHistory ? rediscover : null}
      />
      {busy && <Working busy={busy} />}
      {error && !busy && <Failed error={error} />}
      {run && (
        <RunResult
          run={run}
          busy={busy !== null}
          playlistMode={playlistMode}
          onRefine={refine}
          edits={{ setRemoved, setVote, setSent }}
        />
      )}
      <EarlierMixes currentId={run?.id} onOpen={openRun} />
    </div>
  );
}
