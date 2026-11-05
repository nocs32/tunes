import type { ReactElement } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';

type LoginPageProps = { notice: string | null };

// A plain link, not a fetch: the server answers with a redirect to Spotify's login page.
export function LoginPage({ notice }: LoginPageProps): ReactElement {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Tunes</CardTitle>
          <CardDescription>
            New music picked from your Spotify listening, checked on Spotify, and sent to a playlist in your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <Button asChild size="lg">
            <a href="/api/auth/login">Log in with Spotify</a>
          </Button>
          <p className="text-muted-foreground text-xs">
            Tunes reads your top artists and tracks, recent plays, saved songs and followed artists. It never posts
            anything; playlists are made only when you press the button.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
