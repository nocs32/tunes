# Tunes

A personal music recommender on top of Spotify, for one person and up to four friends (Spotify's Development Mode limit). Not a product.

Log in with Spotify → Tunes reads your listening taste → Claude suggests music you don't know yet, optionally for a mood ("night drive", "focus, no vocals") → every suggestion is checked on Spotify, so nothing made up gets through → the list goes into a playlist in your Spotify account → thumbs up or down per track shapes the next run.

**Status:** M3: suggestions go into a Spotify playlist (a rolling "Tunes" playlist, or a new one per mix). Thumbs up and down come next.

## Stack

- `modules/server`: Node 24 + [Hono](https://hono.dev), SQLite through Node's built-in `node:sqlite`. Node runs the TypeScript directly, so there is no server build.
- `modules/web`: Vite + React 19 + Tailwind 4 + [shadcn/ui](https://ui.shadcn.com). It calls the server through Hono's typed client.
- Claude (Opus 5.5) through the Anthropic API, one call per run.

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
