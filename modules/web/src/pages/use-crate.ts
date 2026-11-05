import { useCallback, useEffect, useState } from 'react';
import { api, type CrateTrack, unwrap } from '@/api.ts';

export type CrateState = {
  tracks: CrateTrack[];
  error: string | null;
  toggle: (trackId: string) => void;
  remove: (trackId: string) => void;
  clear: () => void;
};

export const crateLimit = 10;

// The crate, kept on the server (it survives reloads and works across devices). Every change
// answers with the whole crate, which replaces what's shown.
export const useCrate = (): CrateState => {
  const [tracks, setTracks] = useState<CrateTrack[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((request: Promise<{ tracks: CrateTrack[] }>) => {
    setError(null);
    request.then((crate) => setTracks(crate.tracks)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  useEffect(() => apply(unwrap(api.crate.$get())), [apply]);

  const remove = (trackId: string): void => apply(unwrap(api.crate[':trackId'].$delete({ param: { trackId } })));

  const toggle = (trackId: string): void =>
    tracks.some((track) => track.id === trackId) ? remove(trackId) : apply(unwrap(api.crate.$post({ json: { trackId } })));

  return { tracks, error, toggle, remove, clear: () => apply(unwrap(api.crate.$delete())) };
};
