# Tunes

A personal Spotify + Claude music recommender for the user and up to 4 friends. You log in with Spotify, Tunes builds a compact taste profile, Claude suggests tracks, every suggestion is verified by Spotify search, and the result goes into a playlist in the user's own Spotify account. Not a product, not public.

The full spec is `.scratch/SPEC.md` (git-ignored). **Read §0 "Decisions" before planning anything:** *Decided* rows are settled, *Proposed* rows wait for the user's yes. The user asked to be asked before any choice the spec doesn't cover.

## The Spotify API changed a lot: never trust memory or old tutorials
Spec §5 lists what was checked against developer.spotify.com on 2026-11-05: what's gone (recommendations, audio features, related artists, artist top tracks, browse, batch `?ids=` lookups, `popularity`), what's renamed (`POST /me/playlists`, `/playlists/{id}/items` with `item`, `/me/library` with URIs) and the limits (search 10 per page, library check 40 URIs per call, 429 `QUOTA_EXCEEDED`). Look up anything not listed there in the official docs before writing code.

**Never show a track that wasn't found on Spotify.** Claude can invent songs; verification is the point.

## How we work
Like the sibling projects (Cinemate, the tables): a setup commit (M0), then a branch and PR per milestone (M1 login + taste profile, M2 suggestions + refine, M3 playlist, M4 feedback, M5 deploy). **Stop for the user's review before each PR, and ask before merging.** No CI runs: the user is out of GitHub Actions minutes.

**Verify in the built-in browser** with the `tunes-dev` preview (`.claude/launch.json` in `claude-playground`), at `http://127.0.0.1:5180`, never `localhost`.

**Explain infrastructure plainly** (servers, OAuth, tunnels): the user knows Docker and tooling but is new to backends.

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
- `modules/server`: Hono on Node 24, run straight from TypeScript (imports use `.ts` extensions; only erasable syntax, so no enums or namespaces).
  - `src/app.ts`: the routes under `/api`, exported as `AppType` for the web's typed client. Routes read dependencies from the context (`c.var.db`).
  - `src/index.ts`: starts the server. In production it also serves `modules/web/dist`.
  - `src/env.ts`: settings, checked at start. The server uses `API_PORT` / `API_HOST`, never `PORT`, which tools set for Vite.
  - `src/db/`: `node:sqlite`, migrations in `migrations.ts` (append only; `user_version` counts them).
  - Tests sit next to the code (`*.test.ts`, vitest).
- `modules/web`: Vite + React 19 + Tailwind 4 + shadcn/ui (new-york, neutral; follows the system's dark mode). `src/api.ts` is the typed client.
- Ports: web 5180, server 2574, web preview 4180.
- `.env` at the repo root (git-ignored): `SPOTIFY_CLIENT_ID`, later `ANTHROPIC_API_KEY`. See `.env.example`.
