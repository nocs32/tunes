import { type ReactElement, useState } from 'react';
import { api, type PlaylistMode, type Run, unwrap } from '@/api.ts';
import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label.tsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.tsx';
import { timeAgo } from '@/format.ts';

const modes: { value: PlaylistMode; label: string }[] = [
  { value: 'rolling', label: 'Replace the songs in my “Tunes” playlist' },
  { value: 'new', label: 'Make a new playlist for this mix' },
];

type SendPanelProps = { run: Run; initialMode: PlaylistMode; onSent: (playlist: NonNullable<Run['playlist']>) => void };

function SentNote({ playlist }: { playlist: NonNullable<Run['playlist']> }): ReactElement {
  return (
    <p className="text-sm">
      Sent to “{playlist.name}” {timeAgo(playlist.sentAt)}.{' '}
      <a href={`https://open.spotify.com/playlist/${playlist.id}`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">
        Open in Spotify
      </a>
    </p>
  );
}

function ModeChoice({ mode, onChange }: { mode: PlaylistMode; onChange: (mode: PlaylistMode) => void }): ReactElement {
  return (
    <RadioGroup value={mode} onValueChange={(value) => onChange(value as PlaylistMode)} aria-label="Where the songs go">
      {modes.map((item) => (
        <div key={item.value} className="flex items-center gap-2">
          <RadioGroupItem value={item.value} id={`mode-${item.value}`} />
          <Label htmlFor={`mode-${item.value}`} className="font-normal">
            {item.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

// The main action for a finished run: put its songs (minus the ones left out) into Spotify.
export function SendPanel({ run, initialMode, onSent }: SendPanelProps): ReactElement {
  const [mode, setMode] = useState<PlaylistMode>(initialMode);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = run.tracks.filter((item) => !item.removed).length;

  const send = (): void => {
    setSending(true);
    setError(null);

    unwrap(api.runs[':id'].playlist.$post({ param: { id: String(run.id) }, json: { mode } }))
      .then((sent) => onSent({ id: sent.id, name: sent.name, sentAt: sent.sentAt }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setSending(false));
  };

  return (
    <div className="border-border flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
      <ModeChoice mode={mode} onChange={setMode} />
      <Button size="lg" onClick={send} disabled={sending || count === 0} className="self-start px-8">
        {sending ? 'Sending…' : `Send ${count} songs to Spotify`}
      </Button>
      {run.playlist && !sending && <SentNote playlist={run.playlist} />}
      <p className="text-muted-foreground text-sm">
        Spotify puts new playlists on your profile. To hide one, open it in Spotify and choose Remove from profile; the
        rolling Tunes playlist stays hidden after that.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
