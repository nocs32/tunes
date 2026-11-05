import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { api, isLoggedOut, type Me, unwrap } from './api.ts';
import { LoginPage, ProfilePage } from './pages/index.ts';

const loginNotices: Record<string, string> = {
  denied: 'Login was cancelled on Spotify.',
  failed:
    'Login didn’t work. Try again. If it keeps failing, check that your Spotify account is on the app’s user list.',
};

// Spotify's callback sends the browser back with ?login=denied|failed; show it once, then tidy the URL.
const takeLoginNotice = (): string | null => {
  const reason = new URLSearchParams(window.location.search).get('login');

  if (reason) window.history.replaceState(null, '', '/');

  return reason ? (loginNotices[reason] ?? null) : null;
};

// undefined while checking, null when logged out.
const useMe = (): [Me | null | undefined, (me: null) => void, string | null] => {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    unwrap(api.me.$get())
      .then(setMe)
      .catch((reason: unknown) => {
        setMe(null);

        if (!isLoggedOut(reason)) setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  return [me, setMe, error];
};

export function App(): ReactElement | null {
  const [me, setMe, meError] = useMe();
  const [notice, setNotice] = useState<string | null>(takeLoginNotice);

  const loggedOut = useCallback(
    (message: string | null) => {
      setNotice(message);
      setMe(null);
    },
    [setMe],
  );

  if (me === undefined) return null;

  if (!me) return <LoginPage notice={notice ?? meError} />;

  return <ProfilePage me={me} onLoggedOut={loggedOut} />;
}
