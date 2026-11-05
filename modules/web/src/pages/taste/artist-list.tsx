import type { ReactElement } from 'react';
import type { Profile } from '@/api.ts';
import { Badge } from '@/components/ui/badge.tsx';

type Artist = Profile['artists'][number];

const trendLabel: Record<Artist['trend'], string> = {
  rising: 'Rising',
  steady: 'Steady',
  older: 'Earlier favourite',
};

const trendHelp: Record<Artist['trend'], string> = {
  rising: 'In your last 4 weeks, not in your past year',
  steady: 'Shows up across your lists',
  older: 'Only in your 1-year list',
};

// "#2 for 4 weeks, #2 for 6 months, #6 for the year", skipping lists the artist isn't in.
const rankText = (ranks: Artist['ranks']): string =>
  [
    ['4 weeks', ranks.short_term],
    ['6 months', ranks.medium_term],
    ['the year', ranks.long_term],
  ]
    .filter(([, rank]) => rank)
    .map(([label, rank]) => `#${rank} for ${label}`)
    .join(', ');

function ArtistRow({ artist, position }: { artist: Artist; position: number }): ReactElement {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="text-muted-foreground w-6 text-right text-sm tabular-nums">{position}</span>
      {artist.imageUrl ? (
        <img src={artist.imageUrl} alt="" loading="lazy" className="bg-muted size-10 rounded-full object-cover" />
      ) : (
        <div className="bg-muted size-10 rounded-full" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{artist.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {rankText(artist.ranks)}
          {artist.genres.length > 0 && `; ${artist.genres.slice(0, 3).join(', ')}`}
        </p>
      </div>
      <Badge variant={artist.trend === 'rising' ? 'default' : 'secondary'} title={trendHelp[artist.trend]}>
        {trendLabel[artist.trend]}
      </Badge>
    </li>
  );
}

export function ArtistList({ artists }: { artists: Artist[] }): ReactElement {
  return (
    <ol className="divide-y">
      {artists.map((artist, index) => (
        <ArtistRow key={artist.id} artist={artist} position={index + 1} />
      ))}
    </ol>
  );
}
