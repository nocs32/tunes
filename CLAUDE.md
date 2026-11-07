# Tunes

A personal Spotify + Claude music recommender for the user and up to 4 friends. You log in with Spotify, Tunes builds a compact taste profile, Claude suggests tracks, every suggestion is verified by Spotify search, and the result goes into a playlist in the user's own Spotify account. Not a product, not public.

The full spec is `.scratch/SPEC.md` (git-ignored). **Read §0 "Decisions" before planning anything:** *Decided* rows are settled, *Proposed* rows wait for the user's yes. The user asked to be asked before any choice the spec doesn't cover.

## The Spotify API changed a lot: never trust memory or old tutorials
Spec §5 lists what was checked against developer.spotify.com on 2026-11-05: what's gone (recommendations, audio features, related artists, artist top tracks, browse, batch `?ids=` lookups, `popularity`), what's renamed (`POST /me/playlists`, `/playlists/{id}/items` with `item`, `/me/library` with URIs) and the limits (search 10 per page, library check 40 URIs per call, 429 `QUOTA_EXCEEDED`). Look up anything not listed there in the official docs before writing code.

**Never show a track that wasn't found on Spotify.** Claude can invent songs; verification is the point.

## Hosting
Live on the Pi through `../tables-host` at https://tunes.timnox.dev (service `tunes`, own `Dockerfile`, volume `tunes-data`, settings in the Pi's `~/tables-host/secrets/tunes.env`). Config only in tables-host: not in its README, not on library.timnox.dev. Update after merging: `ssh pi 'cd ~/tables-host && ./deploy.sh tunes'`. Never prune the Pi's build cache.

## How we work
Like the sibling projects (Cinemate, the tables): a setup commit (M0), then a branch and PR per milestone (M1 login + taste profile, M2 suggestions + refine, M3 playlist, M4 feedback, M5 deploy). **Stop for the user's review before each PR, and ask before merging.** No CI runs: the user is out of GitHub Actions minutes.

**Verify in the built-in browser** with the `tunes-dev` preview (`.claude/launch.json` in `claude-playground`), at `http://127.0.0.1:5180`, never `localhost`.

**Explain infrastructure plainly** (servers, OAuth, tunnels): the user knows Docker and tooling but is new to backends.

## The look (frontend-design pass, `.scratch/look-notes.md`)
A mixtape J-card: each run's mood is the tape title on a pink label band (Unbounded), the numbered tracklist sits under it. Keep the band the only loud element.
- Colours are tokens in `modules/web/src/index.css`: cool paper / navy ink, one marker pink (`--primary`). Pink is a fill only, never small text on the light background (2.7:1). Dark mode is navy, not black.
- Type: `font-display` (Unbounded) only for the wordmark and tape titles; Onest for everything else. Japanese falls back to system fonts.
- No cards around everything, no "A · B · C" meta strings, no all-caps labels: plain sentences.

## House lint rules (copied from the siblings, enforced by `pnpm lint`)
- **Size:** at most 40 lines per function (components included) and 300 lines per file. Blank lines and comments don't count.
- **Nested functions:** inside a function, only arrow functions.
- **Names:** camelCase; PascalCase only for React components (written as named `function` declarations) and types.
- **Return types:** required on every function that returns a value. Lambdas passed as arguments or JSX props are exempt.
- **Folders:** every source folder has an `index.ts(x)` entry; no file is named after its own folder. Kebab-case file names.
- **Blank lines:** one before and after every code block. `pnpm lint --fix` adds them.
- `components/ui/` and `lib/utils.ts` are shadcn's generated code and are exempt. Add components with `npx shadcn@4.22.2 add <name>` from `modules/web`: `pnpm dlx shadcn` crashes on pnpm 11.
- Before calling a change done, run `pnpm lint`, `pnpm typecheck` and `pnpm test`. Don't disable rules without asking.

## Layout
- `modules/server`: Hono on Node 24, run straight from TypeScript (imports use `.ts` extensions; only erasable syntax: no enums, namespaces or constructor parameter properties).
  - `src/app.ts`: the routes under `/api`, exported as `AppType` for the web's typed client. Routes read dependencies from the context (`c.var.db`, `c.var.env`, and `c.var.user` behind `requireUser`). Route handlers must return `c.json(...)` directly (not a `Promise<Response>` helper) or the client loses the response type.
  - `src/index.ts`: starts the server. In production it also serves `modules/web/dist`.
  - `src/env.ts`: settings, checked at start. The server uses `API_PORT` / `API_HOST`, never `PORT`, which tools set for Vite.
  - `src/errors.ts`: `ReloginNeeded`, `SpotifyError`, `SpotifyBusy` → `{ error, message }` responses the page explains.
  - `src/auth/`: PKCE login (`routes.ts`), AES-GCM token encryption (`crypto.ts`), sessions (`tunes_session` cookie, 90 days), `requireUser`.
  - `src/spotify/`: `accounts.ts` (authorize URL, token exchange and refresh, scopes), `client.ts` (`spotifyFetch`: 429 handling), `api.ts` (typed calls), `index.ts` (`accessTokenFor`: refreshes a minute early, one refresh per user at a time; a dead login deletes that user's sessions).
  - `src/suggest/`: `prompt.ts` (system prompt + user message), `claude.ts` (Opus 5.5, effort high, `messages.parse` + `zodOutputFormat`, refusals → `ClaudeRefused`, no fallback model), `match.ts` (normalizing, artist/title matching, alternate spellings, search queries), `verify.ts` (search + 14-day cache, 4 at a time), `run.ts` (pipeline: ask 35, keep 25, label known, drop not-found/Russian/repeats/known artists on Adventurous), `banned.ts` (**no Russian songs in recommendations**, the user's rule: Claude is told, and titles or artists with ы э ё ъ and no і ї є ґ are dropped; seeds and the crate are exempt), `store.ts` (runs, run_tracks), `index.ts` (`/api/runs`).
  - `src/playlist/`: `sendRun` (rolling "Tunes 11/07/2026" playlist, songs and date replaced each time; if the remembered one is gone it reuses another of the person's own rolling playlists before making one, since the dev copy and the live site each remember their own; or a new dated playlist). Dates are MM/DD/YYYY, as the user asked. Spotify ignores `public: false`, see the comment there.
  - `src/jobs/`: runs (and reworks) are background jobs: `POST` answers 202 `{ jobId }`, the page polls `GET /api/runs/jobs/:jobId` every 3 s. Needed because Cloudflare cuts off requests after 100 s and runs take 75–130 s. In memory, kept an hour. Tests use `finishJob` / `postRun` from `suggest/fakes.ts`.
  - **Seeds** ("More like this", the crate): `POST /api/runs` takes `seedTrackIds` (up to 10); `run.ts` takes each from the crate or `GET /tracks/{id}`, tells Claude in a `<seed>` section, puts them first with `kind: 'seed'` ("Your pick") and treats Claude suggesting one again as a repeat. A rework keeps the parent's seeds. `runs.seed` holds a JSON array (one early dev row holds a single object; `seedsOf` reads both).
  - `src/history/` (D24, D26): the imported streaming history, per-song totals only (`history_tracks`, `history_imports`; `PUT /api/history` replaces it). The page reads Spotify's zip itself (`web/src/history/`: a small zip reader on `DecompressionStream`, no library) and never sends single plays, IPs or devices. `insights.ts`: `historyText` (what Claude reads: last 12 months lead, "lately" = 3 months, older years one line each as past phases, songs skipped 3+ times and never finished), `historyFilters` (known songs, normalized artist names, skipped ids), `rediscoverCandidates` (5+ plays, none in 12 months). `loadProfile` appends `historyText` fresh, like votes.
  - `src/rediscover/`: Rediscover (`POST /api/runs/rediscover`): Claude (`claude.pick`) picks up to 25 numbers from ~150 old favourites, at most two per artist, in a listening order; each is fetched with `GET /tracks/{id}`; runs have `discovery: 'rediscover'` and tracks `kind: 'old'`. A rework stays Rediscover.
  - Discover is the slider's far end, stored as `adventurous`: drops artists known by id or by normalized name from the history, and keeps one song per artist.
  - `src/crate/`: the crate (`/api/crate`: add by track id, looked up on Spotify; remove; clear; at most 10). It stays until cleared.
  - Web: `pages/song-actions.tsx` (context + the + and ✨ buttons), `pages/use-crate.ts`, `pages/crate-box.tsx` (floats at the bottom only while the crate has songs; `main` gets `pb-48` then). The runs and the crate live in `main-page.tsx` so the taste tab can start a mix.
  - `src/feedback/`: thumbs up / down (one vote per song per person). `feedbackText` is appended to the profile text in `loadProfile` (never cached); `votedSets` drops disliked songs from new runs and labels liked ones as known.
  - `src/taste/`: `collect.ts` (all Spotify reads, slimmed), `profile.ts` (ranked artists with trend, representative tracks, known sets), `prompt-text.ts` (what Claude reads), `index.ts` (`loadProfile`, cached 6 h in `api_cache`; `GET /api/taste`, `POST /api/taste/refresh`).
  - `src/db/`: `node:sqlite`, migrations in `migrations.ts` (append only; `user_version` counts them).
  - Tests sit next to the code (`*.test.ts`, vitest), named after what they test, never after their folder. `src/testing.ts` has `testApp`, `mockFetch`, `cookiesFrom`.
- `modules/web`: Vite + React 19 + Tailwind 4 + shadcn/ui (new-york, neutral; follows the system's dark mode). `src/api.ts` is the typed client plus `unwrap` (JSON or an `ApiError` with the server's message). `src/app.tsx` picks the login or profile page; `src/pages/`.
- **Test votes change the user's real taste data:** take them back (`vote: null`) after checking.
- **Logging in while testing:** the user signs in to Spotify themselves in the browser pane; never type their credentials. The session cookie then stays in the pane.
- Ports: web 5180, server 2574, web preview 4180.
- `.env` at the repo root (git-ignored): `SPOTIFY_CLIENT_ID`, `TOKEN_KEY` (never change it: it logs everyone out), `ANTHROPIC_API_KEY`. See `.env.example`.
- **Real runs cost money** (~$0.13–0.17 each on Opus 5.5, 75–95 s). Test the pipeline with `fakeClaude` in tests; do a real run only to check prompt or matching changes, and say so.
- **Spotify shows some artists and titles romanized** (米津玄師 → Kenshi Yonezu, 廻廻奇譚 → Kaikai Kitan). Claude gives `artist_alt` / `title_alt`; matching accepts either. Changing matching? Bump the `search2:` cache key in `verify.ts` so old misses aren't trusted.
