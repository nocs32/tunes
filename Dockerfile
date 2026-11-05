# syntax=docker/dockerfile:1
#
# Tunes for tables-host (the Raspberry Pi): builds the web page and runs the server.
# The built page is left at /web; tables-host's Caddy image copies it from here and serves it,
# and sends /api/* to this container on port 3000. The server can also serve /web itself.
# Settings (SPOTIFY_CLIENT_ID, TOKEN_KEY, ANTHROPIC_API_KEY, PUBLIC_URL) come from tables-host's
# secrets/tunes.env; the SQLite file lives in /data (a named volume).

FROM node:24-alpine AS build
WORKDIR /app
RUN npm install --global --no-audit --no-fund pnpm@11.21.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY modules/server/package.json modules/server/
COPY modules/web/package.json modules/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @tunes/web build
# The server alone, with only its production dependencies. Node runs its TypeScript directly.
RUN pnpm --filter @tunes/server deploy --prod --legacy /server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production API_PORT=3000 API_HOST=0.0.0.0 DATABASE_PATH=/data/tunes.db WEB_DIST=/web
COPY --from=build /server ./
COPY --from=build /app/modules/web/dist /web
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=1m --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "src/index.ts"]
