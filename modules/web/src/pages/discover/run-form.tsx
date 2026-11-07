import { type ReactElement, useState } from 'react';
import type { Discovery } from '@/api.ts';
import { Button } from '@/components/ui/button.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Slider } from '@/components/ui/slider.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';

const levels: { value: Discovery; label: string; help: string }[] = [
  { value: 'close', label: 'Close', help: 'Songs you haven’t heard by artists you play, and their nearest neighbours.' },
  { value: 'mixed', label: 'Mixed', help: 'About a third from artists you play, the rest from artists new to you.' },
  // Stored as 'adventurous'; shown as Discover (D26).
  { value: 'adventurous', label: 'Discover', help: 'Genuinely new: lesser-known artists you’ve never played, saved or followed, one song each.' },
];

type RunFormProps = {
  busy: boolean;
  initialDiscovery: Discovery;
  onStart: (mood: string, discovery: Discovery) => void;
  // Null until the full history is imported.
  onRediscover: ((mood: string) => void) | null;
};

function DiscoverySlider({ value, onChange }: { value: number; onChange: (value: number) => void }): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <Label>How far from what you usually play?</Label>
      <Slider min={0} max={2} step={1} value={[value]} onValueChange={([next]) => onChange(next ?? 1)} aria-label="How far from what you usually play" />
      <div className="grid grid-cols-3 text-sm">
        {levels.map((level, index) => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(index)}
            className={`${['text-left', 'text-center', 'text-right'][index]} ${index === value ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
          >
            {level.label}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">{levels[value]?.help}</p>
    </div>
  );
}

// Find music, and Rediscover once the full history is imported (D26).
function FormButtons({ busy, onRediscover }: { busy: boolean; onRediscover: (() => void) | null }): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={busy} className="px-8">
          {busy ? 'Finding music…' : 'Find music'}
        </Button>
        {onRediscover && (
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onRediscover}>
            Rediscover old favourites
          </Button>
        )}
      </div>
      {!onRediscover && (
        <p className="text-muted-foreground text-sm">Import your full history on the “Your taste” tab to rediscover old favourites.</p>
      )}
    </div>
  );
}

// The top of the page: one question, one slider, one button.
export function RunForm({ busy, initialDiscovery, onStart, onRediscover }: RunFormProps): ReactElement {
  const [mood, setMood] = useState('');
  const [level, setLevel] = useState(Math.max(0, levels.findIndex((item) => item.value === initialDiscovery)));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(mood, levels[level]?.value ?? 'mixed');
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="mood" className="text-lg font-semibold">
          What’s this mix for?
        </Label>
        <p className="text-muted-foreground text-sm">
          Optional. Claude picks about 25 songs from your taste and each one is looked up on Spotify. Songs you already know are marked, not hidden.
        </p>
        <Textarea
          id="mood"
          value={mood}
          maxLength={300}
          rows={2}
          onChange={(event) => setMood(event.target.value)}
          placeholder="For example: night drive, focus with no vocals, like Kid A but warmer"
          className="bg-card text-base md:text-base"
        />
      </div>
      <DiscoverySlider value={level} onChange={setLevel} />
      <FormButtons busy={busy} onRediscover={onRediscover && (() => onRediscover(mood))} />
    </form>
  );
}
