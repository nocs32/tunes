import { useCallback, useEffect, useState } from 'react';
import { api, isLoggedOut, type Taste, unwrap } from '@/api.ts';

export type TasteState = {
  taste: Taste | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => void;
  reload: () => void;
};

// Loads the profile (cached on the server for a few hours); `refresh` asks Spotify again.
// A dead login sends the person back to the login page with the server's explanation.
export const useTaste = (onLoggedOut: (message: string | null) => void): TasteState => {
  const [taste, setTaste] = useState<Taste | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(
    (request: () => Promise<Taste>) => {
      setError(null);

      request()
        .then(setTaste)
        .catch((reason: unknown) => {
          if (isLoggedOut(reason)) onLoggedOut(reason.code === 'relogin' ? reason.message : null);
          else setError(reason instanceof Error ? reason.message : String(reason));
        })
        .finally(() => setRefreshing(false));
    },
    [onLoggedOut],
  );

  useEffect(() => run(() => unwrap(api.taste.$get())), [run]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    run(() => unwrap(api.taste.refresh.$post()));
  }, [run]);

  // After a history import: what Claude sees changed, Spotify's data didn't.
  const reload = useCallback(() => run(() => unwrap(api.taste.$get())), [run]);

  return { taste, error, refreshing, refresh, reload };
};
