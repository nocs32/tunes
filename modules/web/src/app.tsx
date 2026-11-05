import { type ReactElement, useEffect, useState } from 'react';
import { api } from './api.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';

type ServerState = 'checking' | 'ok' | 'down';

const useServerState = (): ServerState => {
  const [state, setState] = useState<ServerState>('checking');

  useEffect(() => {
    api.health
      .$get()
      .then(async (response) => setState((await response.json()).ok ? 'ok' : 'down'))
      .catch(() => setState('down'));
  }, []);

  return state;
};

const serverLabel: Record<ServerState, string> = {
  checking: 'Checking server…',
  ok: 'Server OK',
  down: 'Server not reachable',
};

// M0 placeholder: proves the page, the server and the database talk to each other.
// M1 replaces it with the Spotify login and the taste profile.
export function App(): ReactElement {
  const server = useServerState();

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Tunes</CardTitle>
          <CardDescription>New music picked from your Spotify taste, checked on Spotify, sent to a playlist.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Badge variant={server === 'down' ? 'destructive' : 'secondary'}>{serverLabel[server]}</Badge>
          <Button disabled>Log in with Spotify (M1)</Button>
        </CardContent>
      </Card>
    </main>
  );
}
