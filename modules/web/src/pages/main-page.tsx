import { type ReactElement, useState } from 'react';
import type { Me } from '@/api.ts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { CrateBox } from './crate-box.tsx';
import { DiscoverPanel } from './discover/index.tsx';
import { type RunsState, useRuns } from './discover/use-runs.ts';
import { ProfileHeader } from './profile-header.tsx';
import { type SongActions, songActionsContext } from './song-actions.tsx';
import { TastePanel } from './taste/index.tsx';
import { crateLimit, useCrate } from './use-crate.ts';
import { type HistoryState, useHistory } from './use-history.ts';

type MainPageProps = { me: Me; onLoggedOut: (message: string | null) => void };

type MainTabsProps = MainPageProps & { tab: string; onTab: (tab: string) => void; runs: RunsState; history: HistoryState };

function MainTabs({ tab, onTab, me, runs, history, onLoggedOut }: MainTabsProps): ReactElement {
  return (
    <Tabs value={tab} onValueChange={onTab} className="gap-8">
      <TabsList variant="line" className="border-border w-full justify-start border-b pb-1">
        <TabsTrigger value="discover" className="flex-none px-3 text-base">
          Discover
        </TabsTrigger>
        <TabsTrigger value="taste" className="flex-none px-3 text-base">
          Your taste
        </TabsTrigger>
      </TabsList>
      <TabsContent value="discover" forceMount className="data-[state=inactive]:hidden">
        <DiscoverPanel playlistMode={me.playlistMode} runs={runs} hasHistory={history.summary !== null} />
      </TabsContent>
      <TabsContent value="taste" forceMount className="data-[state=inactive]:hidden">
        <TastePanel onLoggedOut={onLoggedOut} history={history} />
      </TabsContent>
    </Tabs>
  );
}

// Logged in: Discover (suggestions) first, and the taste profile Claude works from.
// Both panels stay mounted, so switching tabs never loses a run in progress. The runs and the
// crate live here, so a song in either tab can start a mix and bring Discover to the front.
export function MainPage({ me, onLoggedOut }: MainPageProps): ReactElement {
  const runs = useRuns(onLoggedOut);
  const crate = useCrate();
  const history = useHistory();
  const [tab, setTab] = useState('discover');
  const busy = runs.busy !== null;

  const startFrom = (trackIds: string[]): void => {
    runs.moreLike(trackIds);
    setTab('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const actions: SongActions = {
    busy,
    moreLike: (trackId) => startFrom([trackId]),
    crateIds: new Set(crate.tracks.map((track) => track.id)),
    crateFull: crate.tracks.length >= crateLimit,
    toggleCrate: crate.toggle,
  };

  return (
    <main className={`mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 ${crate.tracks.length ? 'pb-48 sm:pb-48' : ''}`}>
      <ProfileHeader me={me} onLoggedOut={onLoggedOut} />
      <songActionsContext.Provider value={actions}>
        <MainTabs tab={tab} onTab={setTab} me={me} runs={runs} history={history} onLoggedOut={onLoggedOut} />
        <CrateBox crate={crate} busy={busy} onFind={() => startFrom(crate.tracks.map((track) => track.id))} />
      </songActionsContext.Provider>
    </main>
  );
}
