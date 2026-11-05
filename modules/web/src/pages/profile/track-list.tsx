import type { ReactElement } from 'react';
import type { Profile } from '@/api.ts';
import { artistNames } from '@/format.ts';

type Track = Profile['tracks'][number];

function TrackCard({ track }: { track: Track }): ReactElement {
  return (
    <li>
      <a
        href={`https://open.spotify.com/track/${track.id}`}
        target="_blank"
        rel="noreferrer"
        className="hover:bg-muted flex items-center gap-3 rounded-md p-2 transition-colors"
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
