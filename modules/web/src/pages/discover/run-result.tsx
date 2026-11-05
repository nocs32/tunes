import { type ReactElement, useState } from 'react';
import type { PlaylistMode, Run } from '@/api.ts';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import { timeAgo } from '@/format.ts';
import { SendPanel } from './send-panel.tsx';
import { TrackRow } from './track-row.tsx';

const dropLabel: Record<Run['dropped'][number]['reason'], string> = {
  not_found: 'not on Spotify',
  duplicate: 'a repeat',
  known_artist: 'an artist you know',
};

const levelWord: Record<Run['discovery'], string> = { close: 'close', mixed: 'mixed', adventurous: 'adventurous' };

// The run as a tape: its title on the label band, in the wide display face. The one loud thing on the page.
function TapeLabel({ run }: { run: Run }): ReactElement {
  const kept = run.tracks.filter((item) => !item.removed).length;
  const took = run.durationMs ? ` in ${Math.round(run.durationMs / 1000)} s` : '';

  return (
    <header className="bg-primary text-primary-foreground rounded-lg px-5 py-6 sm:px-7 sm:py-8">
      <h2 className="font-display line-clamp-3 text-3xl leading-tight font-bold break-words sm:text-4xl">{run.mood || 'Your usual'}</h2>
      {run.note && <p className="mt-2 text-base font-medium">Reworked: “{run.note}”</p>}
      <p className="mt-3 text-sm opacity-80">
        {kept} songs, {levelWord[run.discovery]}. Made {timeAgo(run.createdAt)}
        {took}.
      </p>
    </header>
  );
}

// Songs that didn't make it, with the reason: never hidden, but out of the way.
function DroppedList({ dropped, asked }: { dropped: Run['dropped']; asked: number }): ReactElement | null {
  if (dropped.length === 0) return null;

  return (
    <details className="text-muted-foreground text-sm">
      <summary className="cursor-pointer">
        Claude suggested {asked}; {dropped.length} {dropped.length === 1 ? 'was' : 'were'} left out
      </summary>
      <ul className="mt-2 flex flex-col gap-1 pl-4">
        {dropped.map((item) => (
          <li key={`${item.artist}|${item.title}|${item.reason}`}>
            {item.artist}, “{item.title}”: {dropLabel[item.reason]}
          </li>
        ))}
      </ul>
    </details>
  );
}

function RefineBox({ busy, onRefine }: { busy: boolean; onRefine: (note: string) => void }): ReactElement {
  const [note, setNote] = useState('');

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (note.trim()) onRefine(note);
      }}
    >
      <Label htmlFor="refine" className="text-base font-semibold">
        Not quite it? Tell Claude what to change
      </Label>
      <Textarea
        id="refine"
        value={note}
        maxLength={300}
        rows={2}
        onChange={(event) => setNote(event.target.value)}
        placeholder="For example: less sad, more like number 3, no metal"
        className="bg-card"
      />
      <Button type="submit" variant="secondary" disabled={busy || !note.trim()} className="self-start">
        {busy ? 'Reworking…' : 'Rework the list'}
      </Button>
    </form>
  );
}

type RunResultProps = {
  run: Run;
  busy: boolean;
  playlistMode: PlaylistMode;
  onRefine: (note: string) => void;
  onRemove: (position: number, removed: boolean) => void;
  onSent: (playlist: NonNullable<Run['playlist']>) => void;
};

export function RunResult({ run, busy, playlistMode, onRefine, onRemove, onSent }: RunResultProps): ReactElement {
  return (
    <section className="flex flex-col gap-6" aria-label="Suggestions">
      <TapeLabel run={run} />
      <SendPanel key={run.id} run={run} initialMode={playlistMode} onSent={onSent} />
      <ol className="divide-border divide-y">
        {run.tracks.map((item) => (
          <TrackRow key={item.position} item={item} onRemove={(removed) => onRemove(item.position, removed)} />
        ))}
      </ol>
      <DroppedList dropped={run.dropped} asked={run.asked} />
      <RefineBox busy={busy} onRefine={onRefine} />
    </section>
  );
}
