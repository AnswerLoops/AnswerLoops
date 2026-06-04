FROM node:20-alpine

WORKDIR /app

# Build toolchain for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

# Install pnpm
RUN npm install -g pnpm

# Copy manifest (lockfile is .dockerignored — it's host/macOS-specific)
COPY package.json ./

# Install deps; onlyBuiltDependencies in package.json lets better-sqlite3 compile
RUN pnpm install

# Copy source code
COPY . .

# Build the app
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"]
