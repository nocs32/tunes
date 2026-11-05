import { Check, Plus, Sparkles } from 'lucide-react';
import { createContext, type ReactElement, useContext } from 'react';
import { Button } from '@/components/ui/button.tsx';

// Song actions that start mixes (seed songs, spec D14), shown on any song in a mix or among
// your top tracks:
// - ✨ More like this: a new mix built around this one song;
// - + Add to crate: collect several, then "Find more like these" in the crate box.
// The main page provides the actions; song rows just show the buttons.

export type SongActions = {
  busy: boolean;
  moreLike: (trackId: string) => void;
  crateIds: ReadonlySet<string>;
  crateFull: boolean;
  toggleCrate: (trackId: string) => void;
};

export const songActionsContext = createContext<SongActions>({
  busy: true,
  moreLike: () => undefined,
  crateIds: new Set(),
  crateFull: false,
  toggleCrate: () => undefined,
});

export function MoreLikeButton({ trackId, title }: { trackId: string; title: string }): ReactElement {
  const { moreLike, busy } = useContext(songActionsContext);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      disabled={busy}
      onClick={() => moreLike(trackId)}
      aria-label={`More like ${title}`}
      title={busy ? 'Wait for the current mix to finish' : 'More like this: a new mix built around this song'}
    >
      <Sparkles />
    </Button>
  );
}

export function CrateButton({ trackId, title }: { trackId: string; title: string }): ReactElement {
  const { crateIds, crateFull, toggleCrate } = useContext(songActionsContext);
  const inCrate = crateIds.has(trackId);
  const full = crateFull && !inCrate;

  return (
    <Button
      variant={inCrate ? 'default' : 'ghost'}
      size="icon-sm"
      className={inCrate ? '' : 'text-muted-foreground'}
      disabled={full}
      aria-pressed={inCrate}
      onClick={() => toggleCrate(trackId)}
      aria-label={inCrate ? `Take ${title} out of the crate` : `Add ${title} to the crate`}
      title={inCrate ? 'In your crate (press to take it out)' : full ? 'The crate holds 10 songs' : 'Add to crate'}
    >
      {inCrate ? <Check /> : <Plus />}
    </Button>
  );
}
