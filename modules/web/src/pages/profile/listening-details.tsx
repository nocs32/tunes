import type { ReactElement } from 'react';
import type { Profile } from '@/api.ts';
import { Badge } from '@/components/ui/badge.tsx';

// Recent plays by artist, and genres when Spotify still sends them (they're deprecated).
export function RecentList({ profile }: { profile: Profile }): ReactElement {
  if (profile.recentArtists.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">No recent plays.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-medium">Most played in your last {profile.counts.recentPlays} plays</h3>
        <ol className="divide-y">
          {profile.recentArtists.map((artist) => (
            <li key={artist.name} className="flex justify-between py-2 text-sm">
              <span>{artist.name}</span>
              <span className="text-muted-foreground tabular-nums">×{artist.plays}</span>
            </li>
          ))}
        </ol>
      </section>
      {profile.genres.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Genres Spotify tags your top artists with</h3>
          <div className="flex flex-wrap gap-2">
            {profile.genres.map((genre) => (
              <Badge key={genre.name} variant="outline">
                {genre.name}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// The exact text Claude gets, so nothing about the suggestions is a mystery.
export function ClaudeView({ text }: { text: string }): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        This is everything about your taste that Claude will read when it suggests music (about{' '}
        {Math.round(text.length / 4).toLocaleString()} tokens). Your thumbs up and down will be added here later.
      </p>
      <pre className="bg-muted max-h-[32rem] overflow-auto rounded-md p-4 text-xs leading-relaxed whitespace-pre-wrap">{text}</pre>
    </div>
  );
}
