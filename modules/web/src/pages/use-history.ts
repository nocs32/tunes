import { useCallback, useEffect, useState } from 'react';
import { api, type HistorySummary, unwrap } from '@/api.ts';
import { historyTotals } from '@/history/index.ts';

export type HistoryState = {
  summary: HistorySummary | null;
  loaded: boolean;
  working: 'reading' | 'sending' | 'removing' | null;
  error: string | null;
  importZip: (file: File) => Promise<boolean>;
  remove: () => void;
};

const messageOf = (reason: unknown): string => (reason instanceof Error ? reason.message : String(reason));

// The imported streaming history (D24): what's on the server, and importing a new zip. The zip is
// read here; only per-song totals are sent.
export const useHistory = (): HistoryState => {
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState<HistoryState['working']>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    unwrap(api.history.$get())
      .then((reply) => setSummary(reply.history))
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setLoaded(true));
  }, []);

  const importZip = useCallback(async (file: File): Promise<boolean> => {
    setError(null);
    setWorking('reading');

    try {
      const tracks = await historyTotals(file);

      setWorking('sending');
      setSummary((await unwrap(api.history.$put({ json: { tracks } }))).history);

      return true;
    } catch (reason) {
      setError(messageOf(reason));

      return false;
    } finally {
      setWorking(null);
    }
  }, []);

  const remove = (): void => {
    setError(null);
    setWorking('removing');

    unwrap(api.history.$delete())
      .then(() => setSummary(null))
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setWorking(null));
  };

  return { summary, loaded, working, error, importZip, remove };
};
