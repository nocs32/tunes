import type { ReactElement } from 'react';
import { api, type Me } from '@/api.ts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { Button } from '@/components/ui/button.tsx';

type ProfileHeaderProps = { me: Me; onLoggedOut: (message: string | null) => void };

export function ProfileHeader({ me, onLoggedOut }: ProfileHeaderProps): ReactElement {
  const logOut = (): void => {
    api.auth.logout.$post().finally(() => onLoggedOut(null));
  };

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          {me.imageUrl && <AvatarImage src={me.imageUrl} alt="" />}
          <AvatarFallback>{me.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Tunes</h1>
          <p className="text-muted-foreground text-sm">Logged in as {me.displayName}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={logOut}>
        Log out
      </Button>
    </header>
  );
}
