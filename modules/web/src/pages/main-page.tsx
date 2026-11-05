import type { ReactElement } from 'react';
import type { Me } from '@/api.ts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { DiscoverPanel } from './discover/index.tsx';
import { ProfileHeader } from './profile-header.tsx';
import { TastePanel } from './taste/index.tsx';

type MainPageProps = { me: Me; onLoggedOut: (message: string | null) => void };

// Logged in: Discover (suggestions) first, and the taste profile Claude works from.
// Both panels stay mounted, so switching tabs never loses a run in progress.
export function MainPage({ me, onLoggedOut }: MainPageProps): ReactElement {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <ProfileHeader me={me} onLoggedOut={onLoggedOut} />
      <Tabs defaultValue="discover" className="gap-8">
        <TabsList variant="line" className="border-border w-full justify-start border-b pb-1">
          <TabsTrigger value="discover" className="flex-none px-3 text-base">
            Discover
          </TabsTrigger>
          <TabsTrigger value="taste" className="flex-none px-3 text-base">
            Your taste
          </TabsTrigger>
        </TabsList>
        <TabsContent value="discover" forceMount className="data-[state=inactive]:hidden">
          <DiscoverPanel playlistMode={me.playlistMode} onLoggedOut={onLoggedOut} />
        </TabsContent>
        <TabsContent value="taste" forceMount className="data-[state=inactive]:hidden">
          <TastePanel onLoggedOut={onLoggedOut} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
