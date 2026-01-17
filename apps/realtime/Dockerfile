# TradeFightClub Realtime Server - Railway Deployment
FROM node:20-alpine AS base

# Install dependencies for Prisma
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/logger/package.json ./packages/logger/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/realtime/package.json ./apps/realtime/

# Install dependencies
RUN npm ci --workspace=apps/realtime

# Copy source files
COPY packages/ ./packages/
COPY apps/realtime/ ./apps/realtime/
COPY turbo.json ./

# Generate Prisma Client
RUN npx prisma generate --schema=./packages/db/prisma/schema.prisma

# Build packages and app
RUN npm run build --workspace=@tfc/db
RUN npm run build --workspace=@tfc/shared
RUN npm run build --workspace=@tfc/logger
RUN npm run build --workspace=@tfc/realtime

# Expose port
EXPOSE 3002

# Start server
WORKDIR /app/apps/realtime
CMD ["node", "dist/index.js"]
