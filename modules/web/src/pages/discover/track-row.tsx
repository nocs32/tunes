import { ThumbsDown, ThumbsUp, Undo2, X } from 'lucide-react';
import { createElement, type ReactElement } from 'react';
import type { RunTrack } from '@/api.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { artistNames } from '@/format.ts';
import { MoreLikeButton } from '../more-like.tsx';

type Vote = RunTrack['vote'];

type TrackRowProps = { item: RunTrack; onRemove: (removed: boolean) => void; onVote: (vote: Vote) => void };

function Cover({ url }: { url: string | null }): ReactElement {
  return url ? (
    <img src={url} alt="" loading="lazy" className="bg-muted size-14 shrink-0 rounded-md object-cover" />
  ) : (
    <div className="bg-muted size-14 shrink-0 rounded-md" />
  );
}

// The row's actions, icons only (names in the tooltip and for screen readers): more like this, thumbs up / down,
// which Claude reads in every later run (pressing the active one takes it back), and ✕ to leave it out.
function Actions({ item, onRemove, onVote }: TrackRowProps): ReactElement {
  const name = item.track.name;

  const thumb = (value: NonNullable<Vote>, label: string, icon: typeof ThumbsUp): ReactElement => {
    const active = item.vote === value;

    return (
      <Button
        variant={active ? (value === 'up' ? 'default' : 'secondary') : 'ghost'}
        size="icon-sm"
        aria-pressed={active}
        aria-label={`${label}: ${name}`}
        title={active ? `${label} (press again to take it back)` : label}
        onClick={() => onVote(active ? null : value)}
        className={active ? '' : 'text-muted-foreground'}
      >
        {createElement(icon, { className: active ? 'fill-current' : '' })}
      </Button>
    );
  };

  return (
    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
      <MoreLikeButton trackId={item.track.id} title={name} />
      {thumb('up', 'Good pick', ThumbsUp)}
      {thumb('down', 'Not for me', ThumbsDown)}
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={() => onRemove(!item.removed)}
        aria-label={item.removed ? `Put back ${name}` : `Leave out ${name}`}
        title={item.removed ? 'Put it back' : 'Leave this one out of the playlist'}
      >
        {item.removed ? <Undo2 /> : <X />}
      </Button>
    </div>
  );
}

// One line of the tracklist: its place in the playlist, the song, Claude's note, and the actions.
export function TrackRow({ item, onRemove, onVote }: TrackRowProps): ReactElement {
  const { track } = item;

  return (
    <li className="flex items-start gap-3 py-4 sm:gap-4">
      <div className={`flex min-w-0 flex-1 items-start gap-3 sm:gap-4 ${item.removed ? 'opacity-40' : ''}`}>
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
            {item.kind === 'seed' && <Badge>Your pick</Badge>}
          {item.kind === 'wildcard' && <Badge variant="outline">Wildcard</Badge>}
            {item.known && <Badge variant="secondary">You know this</Badge>}
          </div>
          <p className="text-muted-foreground truncate text-sm">{artistNames(track.artists)}</p>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed">{item.reason}</p>
        </div>
      </div>
      <Actions item={item} onRemove={onRemove} onVote={onVote} />
    </li>
  );
}
