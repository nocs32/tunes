// "just now", "12 min ago", "3 h ago", "2 days ago".
export const timeAgo = (timestamp: number, now = Date.now()): string => {
  const minutes = Math.round((now - timestamp) / 60_000);

  if (minutes < 1) return 'just now';

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);

  return days === 1 ? 'yesterday' : `${days} days ago`;
};

// A mix's title: its mood, or the songs it was built around, or "Old favourites" / "Your usual".
export const mixTitle = (mood: string, seedTitles: string[], mode?: string): string => {
  if (mood) return mood;

  if (mode === 'rediscover') return 'Old favourites';

  const [first, ...others] = seedTitles;

  if (!first) return 'Your usual';

  return others.length ? `More like “${first}” + ${others.length}` : `More like “${first}”`;
};

export const artistNames = (artists: { name: string }[]): string => artists.map((artist) => artist.name).join(', ');
