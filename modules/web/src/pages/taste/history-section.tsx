import { type ReactElement, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { timeAgo } from '@/format.ts';
import type { HistoryState } from '../use-history.ts';

const monthYear = (ms: number | null): string =>
  ms === null ? '?' : new Date(ms).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric', timeZone: 'UTC' });

const workingText = { reading: 'Reading the zip…', sending: 'Sending the totals…', removing: 'Removing…' } as const;

function Imported({ summary }: { summary: NonNullable<HistoryState['summary']> }): ReactElement {
  return (
    <p className="text-sm">
      {summary.plays.toLocaleString()} plays of {summary.tracks.toLocaleString()} songs, {monthYear(summary.firstAt)} to{' '}
      {monthYear(summary.lastAt)}. Imported {timeAgo(summary.importedAt)}.
    </p>
  );
}

type HistorySectionProps = { history: HistoryState; onImported: () => void };

// Spotify's extended streaming history: makes the profile lean on your last 12 months, adds
// Rediscover, and makes Discover skip every artist you've ever played.
export function HistorySection({ history, onImported }: HistorySectionProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const { summary, working, error } = history;

  const pick = async (file: File | undefined): Promise<void> => {
    if (file && (await history.importZip(file))) onImported();

    if (input.current) input.current.value = '';
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Your full history">
      <h3 className="font-semibold">Your full history</h3>
      <p className="text-muted-foreground max-w-prose text-sm">
        Spotify’s “Extended streaming history” (request it in Spotify’s privacy settings; it arrives by email as a zip). Your browser reads
        it and sends Tunes only per-song totals: plays, skips, first and last play. The IP addresses, devices and countries in it never leave
        this computer.
      </p>
      {summary && <Imported summary={summary} />}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />
        <Button variant={summary ? 'outline' : 'default'} size="sm" disabled={working !== null} onClick={() => input.current?.click()}>
          {working ? workingText[working] : summary ? 'Import a newer zip' : 'Import your history (.zip)'}
        </Button>
        {summary && (
          <Button variant="ghost" size="sm" disabled={working !== null} onClick={history.remove}>
            Remove it
          </Button>
        )}
      </div>
    </section>
  );
}
