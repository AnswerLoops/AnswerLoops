# syntax=docker/dockerfile:1

# ── deps ──────────────────────────────────────────────────────────────
# Install dependencies once, compiling native modules (better-sqlite3).
# Dev compose targets this stage so it never runs a production build.
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ gcc
RUN npm install -g pnpm
# Lockfile is .dockerignored (host/macOS-specific); onlyBuiltDependencies in
# package.json lets better-sqlite3 compile.
COPY package.json ./
RUN pnpm install

# ── build ─────────────────────────────────────────────────────────────
# Produce the optimized .next production build.
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm build

# ── runner ────────────────────────────────────────────────────────────
# Lean production image: no build toolchain. Serves both the app
# (`pnpm start`) and the bot (`pnpm bot:start`) via command override.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm \
  && addgroup -S app && adduser -S app -G app

# Copy the whole built tree: compiled node_modules, .next, and source.
# Source is needed at runtime — schema.sql is read via fs, and the bot
# runs through tsx. .dockerignore keeps data/ and secrets out.
COPY --from=build /app ./

# Persistent SQLite lives here; mount a named volume at /data.
RUN mkdir -p /data && chown -R app:app /app /data
USER app

EXPOSE 3000
CMD ["pnpm", "start"]
