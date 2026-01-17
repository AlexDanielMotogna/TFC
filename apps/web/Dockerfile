# TradeFightClub Web - Railway Deployment
FROM node:20-alpine AS base

# Install dependencies for Prisma and native modules
RUN apk add --no-cache openssl libc6-compat python3 make g++ linux-headers eudev-dev libusb-dev

# Set working directory
WORKDIR /app

# Build the application
FROM base AS builder
WORKDIR /app

# Copy everything and install
COPY . .
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate --schema=./packages/db/prisma/schema.prisma

# Build packages
RUN npm run build --workspace=@tfc/db
RUN npm run build --workspace=@tfc/shared
RUN npm run build --workspace=@tfc/logger

# Build Next.js app (npx downloads next@14.2.20 since .bin symlink missing)
WORKDIR /app/apps/web
RUN npx next@14.2.20 build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone server
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Install next module that server.js requires (standalone expects it at apps/web/node_modules/next)
# Create a clean package.json to avoid resolving workspace dependencies
RUN mkdir -p /app/apps/web/node_modules && \
    cd /app/apps/web && \
    echo '{"name":"web-runtime","private":true}' > package.json && \
    npm install next@14.2.20 --legacy-peer-deps

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
