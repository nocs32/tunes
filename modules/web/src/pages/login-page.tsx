import type { ReactElement } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';

type LoginPageProps = { notice: string | null };

// The same label band as a run, with the app's name on it.
// The button is a plain link: the server answers with a redirect to Spotify's login page.
export function LoginPage({ notice }: LoginPageProps): ReactElement {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="bg-primary text-primary-foreground rounded-lg px-6 py-8">
        <h1 className="font-display text-5xl font-bold tracking-tight">Tunes</h1>
        <p className="mt-3 text-base">Music you don’t know yet, picked from what you play on Spotify.</p>
      </header>
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <Button asChild size="lg">
        <a href="/api/auth/login">Log in with Spotify</a>
      </Button>
      <p className="text-muted-foreground text-sm">
        Tunes reads your top artists and tracks, recent plays, saved songs and followed artists. It only makes a playlist when
        you ask it to.
      </p>
    </main>
  );
}
