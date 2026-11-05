import { type ReactElement, useEffect, useState } from 'react';
import { api, type RunSummary, unwrap } from '@/api.ts';
import { mixTitle, timeAgo } from '@/format.ts';

const loadRuns = async (): Promise<RunSummary[]> => (await unwrap(api.runs.$get())).runs;

type EarlierMixesProps = { currentId: number | undefined; onOpen: (runId: number) => void };

function MixRow({ item, current, onOpen }: { item: RunSummary; current: boolean; onOpen: () => void }): ReactElement {
  const sent = item.playlist ? `, sent to “${item.playlist.name}”` : '';

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={current}
        className="hover:bg-muted aria-[current=true]:bg-muted flex w-full flex-col items-start rounded-md px-3 py-2 text-left"
      >
        <span className="font-display line-clamp-1 text-base font-bold break-all">{mixTitle(item.mood, item.seedTitles)}</span>
        <span className="text-muted-foreground text-sm">
          {item.note ? `Reworked: “${item.note}”. ` : ''}
          {item.songs} songs, {timeAgo(item.createdAt)}
          {sent}
        </span>
      </button>
    </li>
  );
}

// Every earlier mix, newest first. Opening one shows it above, ready to send or rework again.
// Reloads whenever the shown run changes (a new run or a reworked one appears at the top).
export function EarlierMixes({ currentId, onOpen }: EarlierMixesProps): ReactElement | null {
  const [runs, setRuns] = useState<RunSummary[]>([]);

  useEffect(() => {
    loadRuns()
      .then(setRuns)
      .catch(() => undefined);
  }, [currentId]);

  if (runs.length < 2) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Earlier mixes">
      <h2 className="text-lg font-semibold">Earlier mixes</h2>
      <ul className="flex flex-col gap-1">
        {runs.map((item) => (
          <MixRow key={item.id} item={item} current={item.id === currentId} onOpen={() => onOpen(item.id)} />
        ))}
      </ul>
    </section>
  );
}
