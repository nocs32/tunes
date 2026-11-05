import { type ReactElement, useState } from 'react';
import type { Me } from '@/api.ts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { DiscoverPanel } from './discover/index.tsx';
import { useRuns } from './discover/use-runs.ts';
import { moreLikeContext } from './more-like.tsx';
import { ProfileHeader } from './profile-header.tsx';
import { TastePanel } from './taste/index.tsx';

type MainPageProps = { me: Me; onLoggedOut: (message: string | null) => void };

// Logged in: Discover (suggestions) first, and the taste profile Claude works from.
// Both panels stay mounted, so switching tabs never loses a run in progress. The runs live here,
// so "More like this" on a song in either tab can start a mix and bring Discover to the front.
export function MainPage({ me, onLoggedOut }: MainPageProps): ReactElement {
  const runs = useRuns(onLoggedOut);
  const [tab, setTab] = useState('discover');

  const moreLike = {
    busy: runs.busy !== null,
    start: (trackId: string): void => {
      runs.moreLike(trackId);
      setTab('discover');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <ProfileHeader me={me} onLoggedOut={onLoggedOut} />
      <moreLikeContext.Provider value={moreLike}>
        <Tabs value={tab} onValueChange={setTab} className="gap-8">
          <TabsList variant="line" className="border-border w-full justify-start border-b pb-1">
            <TabsTrigger value="discover" className="flex-none px-3 text-base">
              Discover
            </TabsTrigger>
            <TabsTrigger value="taste" className="flex-none px-3 text-base">
              Your taste
            </TabsTrigger>
          </TabsList>
          <TabsContent value="discover" forceMount className="data-[state=inactive]:hidden">
            <DiscoverPanel playlistMode={me.playlistMode} runs={runs} />
          </TabsContent>
          <TabsContent value="taste" forceMount className="data-[state=inactive]:hidden">
            <TastePanel onLoggedOut={onLoggedOut} />
          </TabsContent>
        </Tabs>
      </moreLikeContext.Provider>
    </main>
  );
}
