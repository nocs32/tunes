import type { ReactElement } from 'react';
import type { Taste } from '@/api.ts';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { timeAgo } from '@/format.ts';
import { ArtistList } from './artist-list.tsx';
import { ClaudeView, RecentList } from './listening-details.tsx';
import { TrackList } from './track-list.tsx';
import { useTaste } from './use-taste.ts';

function Stats({ taste }: { taste: Taste }): ReactElement {
  const { counts } = taste.profile;

  const items = [
    ['saved songs', counts.saved],
    ['followed artists', counts.followed],
    ['songs Tunes knows you know', taste.knownCounts.tracks],
    ['artists you know', taste.knownCounts.artists],
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col-reverse">
          <dt className="text-muted-foreground text-sm">{label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

function TasteTabs({ taste }: { taste: Taste }): ReactElement {
  const { profile } = taste;

  return (
    <Tabs defaultValue="artists">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="artists">Artists</TabsTrigger>
        <TabsTrigger value="tracks">Tracks</TabsTrigger>
        <TabsTrigger value="recent">Recent</TabsTrigger>
        <TabsTrigger value="claude">
          <span className="sm:hidden">For Claude</span>
          <span className="hidden sm:inline">What Claude sees</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="artists">
        <ArtistList artists={profile.artists} />
      </TabsContent>
      <TabsContent value="tracks">
        <TrackList tracks={profile.tracks} />
      </TabsContent>
      <TabsContent value="recent">
        <RecentList profile={profile} />
      </TabsContent>
      <TabsContent value="claude">
        <ClaudeView text={profile.promptText} />
      </TabsContent>
    </Tabs>
  );
}

function Loading(): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

type TastePanelProps = { onLoggedOut: (message: string | null) => void };

export function TastePanel({ onLoggedOut }: TastePanelProps): ReactElement {
  const { taste, error, refreshing, refresh } = useTaste(onLoggedOut);

  return (
    <section className="flex flex-col gap-8" aria-label="Your taste">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">What Tunes knows about your listening</h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            From your Spotify top lists for the last 4 weeks, 6 months and year, your recent plays, saved songs and followed
            artists.{taste && ` Updated ${timeAgo(taste.fetchedAt)}.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || !taste}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {taste ? <Stats taste={taste} /> : !error && <Loading />}
      {taste && <TasteTabs taste={taste} />}
    </section>
  );
}
