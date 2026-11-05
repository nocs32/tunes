import { X } from 'lucide-react';
import type { ReactElement } from 'react';
import type { CrateTrack } from '@/api.ts';
import { Button } from '@/components/ui/button.tsx';
import { artistNames } from '@/format.ts';
import type { CrateState } from './use-crate.ts';

function CrateSong({ track, onRemove }: { track: CrateTrack; onRemove: () => void }): ReactElement {
  return (
    <li className="bg-muted flex w-44 shrink-0 items-center gap-2 rounded-md p-1.5">
      {track.imageUrl ? (
        <img src={track.imageUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
      ) : (
        <div className="bg-background size-9 shrink-0 rounded" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track.name}</p>
        <p className="text-muted-foreground truncate text-xs">{artistNames(track.artists)}</p>
      </div>
      <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label={`Take ${track.name} out of the crate`} title="Take it out">
        <X />
      </Button>
    </li>
  );
}

type CrateBoxProps = { crate: CrateState; busy: boolean; onFind: () => void };

// Floats at the bottom of the screen, only while the crate has songs in it. Lined up with the page
// column; the page leaves room under its content so the box never hides a song.
export function CrateBox({ crate, busy, onFind }: CrateBoxProps): ReactElement | null {
  const count = crate.tracks.length;

  if (count === 0) return null;

  return (
    <aside
      aria-label="Your crate"
      className="bg-card border-border fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-lg border p-3 shadow-lg sm:inset-x-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-display font-bold">Crate</span>{' '}
          <span className="text-muted-foreground text-sm">
            {count} {count === 1 ? 'song' : 'songs'}
          </span>
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={crate.clear}>
            Clear
          </Button>
          <Button size="sm" onClick={onFind} disabled={busy} title={busy ? 'Wait for the current mix to finish' : undefined}>
            Find more like {count === 1 ? 'this' : 'these'}
          </Button>
        </div>
      </div>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {crate.tracks.map((track) => (
          <CrateSong key={track.id} track={track} onRemove={() => crate.remove(track.id)} />
        ))}
      </ul>
      {crate.error && <p className="text-destructive mt-1 text-sm">{crate.error}</p>}
    </aside>
  );
}
