import type { ReactElement } from 'react';
import type { Profile } from '@/api.ts';
import { artistNames } from '@/format.ts';
import { MoreLikeButton } from '../more-like.tsx';

type Track = Profile['tracks'][number];

// A song you play a lot, with "More like this" to build a mix around it.
function TrackCard({ track }: { track: Track }): ReactElement {
  return (
    <li className="flex items-center gap-1">
      <a
        href={`https://open.spotify.com/track/${track.id}`}
        target="_blank"
        rel="noreferrer"
        className="hover:bg-muted flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 transition-colors"
      >
        {track.imageUrl ? (
          <img src={track.imageUrl} alt="" loading="lazy" className="bg-muted size-12 rounded object-cover" />
        ) : (
          <div className="bg-muted size-12 rounded" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">{track.name}</p>
          <p className="text-muted-foreground truncate text-sm">{artistNames(track.artists)}</p>
          <p className="text-muted-foreground truncate text-xs">{track.album}</p>
        </div>
      </a>
      <MoreLikeButton trackId={track.id} title={track.name} />
    </li>
  );
}

export function TrackList({ tracks }: { tracks: Track[] }): ReactElement {
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} />
      ))}
    </ul>
  );
}
