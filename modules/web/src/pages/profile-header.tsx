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
      <h1 className="font-display text-2xl font-bold tracking-tight">Tunes</h1>
      <div className="flex items-center gap-2">
        <Avatar className="size-7">
          {me.imageUrl && <AvatarImage src={me.imageUrl} alt="" />}
          <AvatarFallback className="text-xs">{me.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground hidden text-sm sm:inline">{me.displayName}</span>
        <Button variant="ghost" size="sm" onClick={logOut}>
          Log out
        </Button>
      </div>
    </header>
  );
}
