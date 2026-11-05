import type { ReactElement } from 'react';
import type { RunTrack } from '@/api.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { artistNames } from '@/format.ts';

type TrackRowProps = { item: RunTrack; onRemove: (removed: boolean) => void };

function Cover({ url }: { url: string | null }): ReactElement {
  return url ? (
    <img src={url} alt="" loading="lazy" className="bg-muted size-14 shrink-0 rounded-md object-cover" />
  ) : (
    <div className="bg-muted size-14 shrink-0 rounded-md" />
  );
}

// One line of the tracklist: its place in the playlist, the song, Claude's note, and ✕ to leave it out.
export function TrackRow({ item, onRemove }: TrackRowProps): ReactElement {
  const { track } = item;

  return (
    <li className={`flex items-start gap-3 py-4 sm:gap-4 ${item.removed ? 'opacity-40' : ''}`}>
      <span className="text-muted-foreground w-6 shrink-0 pt-0.5 text-right text-sm tabular-nums">{item.position + 1}</span>
      <Cover url={track.imageUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a
            href={`https://open.spotify.com/track/${track.id}`}
            target="_blank"
            rel="noreferrer"
            className={`font-semibold underline-offset-4 hover:underline ${item.removed ? 'line-through' : ''}`}
          >
            {track.name}
          </a>
          {item.kind === 'wildcard' && <Badge variant="outline">Wildcard</Badge>}
          {item.known && <Badge variant="secondary">You know this</Badge>}
        </div>
        <p className="text-muted-foreground truncate text-sm">{artistNames(track.artists)}</p>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed">{item.reason}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground shrink-0"
        onClick={() => onRemove(!item.removed)}
        aria-label={item.removed ? `Put back ${track.name}` : `Leave out ${track.name}`}
        title={item.removed ? 'Put it back' : 'Leave this one out'}
      >
        {item.removed ? 'Undo' : '✕'}
      </Button>
    </li>
  );
}
