import { Sparkles } from 'lucide-react';
import { createContext, type ReactElement, useContext } from 'react';
import { Button } from '@/components/ui/button.tsx';

// "More like this" (seed songs, spec D14): any song can start a new mix built around it.
// The main page provides the action; song rows anywhere just show the button.

export type MoreLike = { start: (trackId: string) => void; busy: boolean };

export const moreLikeContext = createContext<MoreLike>({ start: () => undefined, busy: true });

export function MoreLikeButton({ trackId, title }: { trackId: string; title: string }): ReactElement {
  const { start, busy } = useContext(moreLikeContext);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      disabled={busy}
      onClick={() => start(trackId)}
      aria-label={`More like ${title}`}
      title={busy ? 'Wait for the current mix to finish' : 'More like this: a new mix built around this song'}
    >
      <Sparkles />
    </Button>
  );
}
