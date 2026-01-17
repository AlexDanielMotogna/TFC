# Railway Deployment - Lecciones Aprendidas

## Problema Principal
Desplegar Next.js 14 desde un monorepo con npm workspaces a Railway usando Docker.

## Errores y Soluciones

### 1. `sh: next: not found`
**Causa:** Los symlinks en `node_modules/.bin/next` no funcionan correctamente en npm workspaces dentro de Docker.

**NO funciona:**
```dockerfile
RUN npm run build  # usa el symlink
RUN npx next build  # descarga next v16 (última)
```

**Solución:**
```dockerfile
RUN node ../../node_modules/next/dist/bin/next build
```

### 2. `npx next build` descarga Next.js 16 (Turbopack)
**Causa:** `npx next build` sin versión descarga la última versión (v16 con Turbopack que tiene errores).

**NO funciona:**
```dockerfile
RUN npx next build  # descarga v16
```

**Solución:** Especificar versión O usar node directamente:
```dockerfile
RUN npx next@14.2.20 build  # OK pero lento
RUN node ../../node_modules/next/dist/bin/next build  # MEJOR
```

### 3. Prerender errors con `useContext`
**Causa:** Páginas que usan WalletProvider hooks no pueden ser pre-renderizadas estáticamente.

**Solución en `layout.tsx`:**
```typescript
export const dynamic = 'force-dynamic';
```

**Y crear páginas de error sin hooks:**
- `src/app/not-found.tsx`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/pages/_error.js`

### 4. TypeScript `params is possibly null`
**Causa:** Next.js habilita `strictNullChecks` automáticamente.

**Solución:** Usar optional chaining:
```typescript
// Antes
const id = params.id;
// Después
const id = params?.id;
```

### 5. `npm error Missing script: "start"`
**Causa:** Railway tenía un custom start command configurado.

**Solución:** Eliminar custom start command en Railway settings. El CMD del Dockerfile es suficiente.

### 6. `Cannot find module 'next'` en runtime
**Causa:** El `server.js` standalone espera next en `apps/web/node_modules/next`.

**NO funciona:**
```dockerfile
# El standalone no incluye next
COPY --from=builder /app/apps/web/.next/standalone ./
```

**Solución:** Copiar next del builder:
```dockerfile
COPY --from=builder /app/node_modules/next ./apps/web/node_modules/next
COPY --from=builder /app/node_modules/@next ./apps/web/node_modules/@next
```

### 7. `@tfc/shared is not in this registry`
**Causa:** Al hacer `npm install` en runner, npm encuentra el `package.json` raíz con workspace dependencies.

**NO funciona:**
```dockerfile
RUN npm install next@14.2.20  # intenta resolver @tfc/shared
```

**Solución:** Copiar next del builder en lugar de instalar (ver #6).

### 8. `npm install next` elimina otras dependencias
**Causa:** `npm install next@14.2.20 --legacy-peer-deps` modifica el árbol de dependencias y elimina paquetes.

**NO funciona:**
```dockerfile
RUN npm ci
RUN npm install next@14.2.20  # elimina react y otros
```

**Solución:** No instalar next por separado. Usar el que ya instaló `npm ci`:
```dockerfile
RUN node ../../node_modules/next/dist/bin/next build
```

## Dockerfile Final Funcional

```dockerfile
# TradeFightClub Web - Railway Deployment
FROM node:20-alpine AS base

# Install dependencies for Prisma and native modules
RUN apk add --no-cache openssl libc6-compat python3 make g++ linux-headers eudev-dev libusb-dev

WORKDIR /app

# Build stage
FROM base AS builder
WORKDIR /app

COPY . .
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate --schema=./packages/db/prisma/schema.prisma

# Build workspace packages
RUN npm run build --workspace=@tfc/db
RUN npm run build --workspace=@tfc/shared
RUN npm run build --workspace=@tfc/logger

# Build Next.js app using node directly (avoids symlink issues)
WORKDIR /app/apps/web
RUN node ../../node_modules/next/dist/bin/next build

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

# Copy next module directly from builder (avoids npm resolution issues)
COPY --from=builder /app/node_modules/next ./apps/web/node_modules/next
COPY --from=builder /app/node_modules/@next ./apps/web/node_modules/@next

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

## Variables de Entorno Requeridas en Railway

- `DATABASE_URL` - Connection string de Supabase
- `NEXT_PUBLIC_REALTIME_URL` - URL del websocket server (si aplica)

## Notas Importantes

1. **No usar npm/npx para ejecutar next** - Usar `node` directamente
2. **No instalar paquetes en runner** - Copiar del builder
3. **force-dynamic en layout.tsx** - Evita errores de prerender con hooks
4. **Crear páginas de error** - Sin usar hooks de contexto
