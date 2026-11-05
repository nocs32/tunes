import { z } from 'zod';

// A Spotify track id: 22 letters and digits. Checked before it goes into a Spotify URL.
export const spotifyTrackId = z.string().regex(/^[A-Za-z0-9]{22}$/, 'not a Spotify track id');
