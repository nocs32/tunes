# Tunes

A personal music recommender on top of Spotify, for one person and up to four friends (Spotify's Development Mode limit). Not a product.

Log in with Spotify → Tunes reads your listening taste → Claude suggests music you don't know yet, optionally for a mood ("night drive", "focus, no vocals") → every suggestion is checked on Spotify, so nothing made up gets through → the list goes into a playlist in your Spotify account → thumbs up or down per track shapes the next run.

**Live at https://tunes.timnox.dev** on a Raspberry Pi (see [On the Pi](#on-the-pi-tables-host)). Only Spotify accounts added to the app's user list can log in.

**What it does now:**
- **Discover:** an optional mood ("night drive", "focus, no vocals") and a slider from close to adventurous. Claude suggests about 25 songs with a one-line reason each.
- **Checked against Spotify:** every song is looked up before you see it, so nothing made up gets through. Songs you already know are marked, not hidden.
- **Rework and trim:** "rework the list" with a note, and ✕ to leave songs out.
- **Send to Spotify:** your rolling "Tunes 11/07/2026" playlist (songs and date replaced each time), or a new playlist per mix.
- **No Russian songs:** Claude is told not to suggest any, and songs whose title or artist is written with Russian-only letters are dropped.
- **Thumbs up or down** on every song. Claude reads them on later runs, and a song you disliked never comes back.
- **Your taste:** what Tunes knows about your listening, and the exact text Claude reads.
- **More like this** (✨) on any song, in a mix or among your top tracks: a new mix built around that song, which goes first in the list.
- **The crate** (+ on any song): collect up to 10 songs you liked, then **Find more like these** in the floating crate box for a mix built around all of them. The crate stays until you clear it.
- **Earlier mixes:** reopen any past mix.

## Stack

- `modules/server`: Node 24 + [Hono](https://hono.dev), SQLite through Node's built-in `node:sqlite`. Node runs the TypeScript directly, so there is no server build.
- `modules/web`: Vite + React 19 + Tailwind 4 + [shadcn/ui](https://ui.shadcn.com). It calls the server through Hono's typed client.
- Claude (Opus 5.5) through the Anthropic API, one call per run (about $0.13–0.25 each).

## Run it locally

You need Node 24+ and pnpm 11.

1. Create a Spotify app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard). Select Web API and add the redirect URI `http://127.0.0.1:5180/api/auth/callback`.
2. Copy `.env.example` to `.env` and fill in `SPOTIFY_CLIENT_ID`, a `TOKEN_KEY` (the file says how to make one) and `ANTHROPIC_API_KEY`.
3. Run:

```bash
pnpm install
pnpm dev
```

4. Open **http://127.0.0.1:5180**. Use the IP, not `localhost`: Spotify refuses `localhost` redirects.

## Commands

```bash
pnpm dev         # web on 127.0.0.1:5180 (forwards /api) + server on 127.0.0.1:2574
pnpm lint        # add --fix for spacing
pnpm typecheck
pnpm test
pnpm build       # builds the web page into modules/web/dist
pnpm start       # the server alone; with NODE_ENV=production it also serves the built page
```

## On the Pi (tables-host)

Tunes runs on the Raspberry Pi next to the table games, through [tables-host](https://github.com/nocs32/tables-host): a `tunes` service built from this repo's `Dockerfile`, Caddy serving the page at **https://tunes.timnox.dev** and sending `/api` to the container, and the shared Cloudflare Tunnel. It's reached by its address only, not listed on the games' library page.

- **Settings:** `~/tables-host/secrets/tunes.env` on the Pi (never in a repo):
  `PUBLIC_URL=https://tunes.timnox.dev`, `SPOTIFY_CLIENT_ID`, `ANTHROPIC_API_KEY`, and the Pi's own `TOKEN_KEY` (made once on the Pi; changing it logs everyone out).
- **Data:** the `tunes-data` volume (`/data/tunes.db`). `docker compose down -v` would delete it.
- **Update** after merging to `main`: `ssh pi 'cd ~/tables-host && ./deploy.sh tunes'`.
- **Spotify:** `https://tunes.timnox.dev/api/auth/callback` must be a redirect URI in the Spotify dashboard, and each friend must be added there (name + Spotify email) before they can use it. Development Mode allows 5 people.
- **Long runs:** a run takes 1–2 minutes, more than Cloudflare's 100-second limit for one request, so the page starts it as a job and checks back every few seconds.
