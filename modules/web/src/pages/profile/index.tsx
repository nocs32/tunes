import type { ReactElement } from 'react';
import type { Me, Taste } from '@/api.ts';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { timeAgo } from '@/format.ts';
import { ArtistList } from './artist-list.tsx';
import { ClaudeView, RecentList } from './listening-details.tsx';
import { ProfileHeader } from './profile-header.tsx';
import { TrackList } from './track-list.tsx';
import { useTaste } from './use-taste.ts';

function Stats({ taste }: { taste: Taste }): ReactElement {
  const { counts } = taste.profile;

  const items = [
    ['Saved songs', counts.saved],
    ['Followed artists', counts.followed],
    ['Songs Tunes knows you know', taste.knownCounts.tracks],
    ['Artists you know', taste.knownCounts.artists],
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="bg-muted rounded-md p-3">
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</dd>
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

type ProfilePageProps = { me: Me; onLoggedOut: (message: string | null) => void };

export function ProfilePage({ me, onLoggedOut }: ProfilePageProps): ReactElement {
  const { taste, error, refreshing, refresh } = useTaste(onLoggedOut);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <ProfileHeader me={me} onLoggedOut={onLoggedOut} />
      <Card>
        <CardHeader>
          <CardTitle>Your taste</CardTitle>
          <CardDescription>
            From your Spotify top lists (last 4 weeks, 6 months and 1 year), recent plays, saved songs and followed artists.
            {taste && ` Updated ${timeAgo(taste.fetchedAt)}.`}
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || !taste}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {taste ? <Stats taste={taste} /> : !error && <Loading />}
          {taste && <TasteTabs taste={taste} />}
        </CardContent>
      </Card>
    </main>
  );
}
