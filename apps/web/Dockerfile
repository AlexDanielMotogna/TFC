# TradeFightClub Web - Railway Deployment
FROM node:20-alpine AS base

# Install dependencies for Prisma and native modules
RUN apk add --no-cache openssl libc6-compat python3 make g++ linux-headers eudev-dev libusb-dev

# Set working directory
WORKDIR /app

# Build the application
FROM base AS builder
WORKDIR /app

# Build-time args for NEXT_PUBLIC_ variables (embedded at build time)
# These MUST be passed as Docker build args (Railway does this automatically from env vars)
ARG NEXT_PUBLIC_WS_URL=wss://tfcrealtime-staging.up.railway.app
ARG NEXT_PUBLIC_REALTIME_URL=wss://tfcrealtime-staging.up.railway.app
ARG NEXT_PUBLIC_PACIFICA_API_URL=https://api.pacifica.fi
ARG NEXT_PUBLIC_PACIFICA_WS_URL=wss://ws.pacifica.fi/ws
ARG NEXT_PUBLIC_PACIFICA_BUILDER_CODE
ARG NEXT_PUBLIC_SOLANA_NETWORK=devnet
ARG NEXT_PUBLIC_SOLANA_RPC_URL
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_HYPERLIQUID_API_URL
ARG NEXT_PUBLIC_HYPERLIQUID_WS_URL
ARG NEXT_PUBLIC_TRADEFIGHTCLUB_FEE_WALLET
ARG NEXT_PUBLIC_ENABLE_BUILDER_FEES

# Set as ENV for build process
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL
ENV NEXT_PUBLIC_PACIFICA_API_URL=$NEXT_PUBLIC_PACIFICA_API_URL
ENV NEXT_PUBLIC_PACIFICA_WS_URL=$NEXT_PUBLIC_PACIFICA_WS_URL
ENV NEXT_PUBLIC_PACIFICA_BUILDER_CODE=$NEXT_PUBLIC_PACIFICA_BUILDER_CODE
ENV NEXT_PUBLIC_SOLANA_NETWORK=$NEXT_PUBLIC_SOLANA_NETWORK
ENV NEXT_PUBLIC_SOLANA_RPC_URL=$NEXT_PUBLIC_SOLANA_RPC_URL
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_HYPERLIQUID_API_URL=$NEXT_PUBLIC_HYPERLIQUID_API_URL
ENV NEXT_PUBLIC_HYPERLIQUID_WS_URL=$NEXT_PUBLIC_HYPERLIQUID_WS_URL
ENV NEXT_PUBLIC_TRADEFIGHTCLUB_FEE_WALLET=$NEXT_PUBLIC_TRADEFIGHTCLUB_FEE_WALLET
ENV NEXT_PUBLIC_ENABLE_BUILDER_FEES=$NEXT_PUBLIC_ENABLE_BUILDER_FEES

# Copy everything and install (skip husky prepare script — not needed in Docker)
COPY . .
RUN npm ci --ignore-scripts && npm rebuild

# Generate Prisma Client
RUN npx prisma generate --schema=./packages/db/prisma/schema.prisma

# Build packages
RUN npm run build --workspace=@tfc/db
RUN npm run build --workspace=@tfc/shared
RUN npm run build --workspace=@tfc/logger

# Build Next.js app (npm handles next resolution in workspace)
RUN npm run build --workspace=@tfc/web

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

# Copy next module from workspace node_modules (if not included in standalone)
COPY --from=builder /app/node_modules/next ./node_modules/next

# Copy Prisma client (required for database queries)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema (required for runtime validation)
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Ensure Next.js can write to cache directories at runtime (ISR/prerender)
RUN mkdir -p /app/apps/web/.next/cache
RUN chown -R nextjs:nodejs /app/apps/web/.next

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
