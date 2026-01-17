# Trading Fight Club - Implementation Plan

> **Single Source of Truth**: `Master-doc.md`
> **Status**: En progreso
> **Última actualización**: 2026-01-02

---

## Resumen de Decisiones Técnicas

| Decisión | Valor |
|----------|-------|
| Monorepo | Turborepo |
| Backend Framework | Node.js + NestJS |
| Database | PostgreSQL + Prisma |
| Realtime | WebSocket (ws library) |
| Frontend | Next.js 14 + React + TailwindCSS |
| Wallet | Solana Wallet Adapter |
| Charts | TradingView Lightweight Charts |
| Logging | Structured JSON + Sentry |
| Secrets | Vault/Secret Manager (reference-based) |

---

## Fase 0: Setup Inicial

### 0.1 Estructura del Proyecto
- [x] Inicializar Turborepo
- [x] Crear estructura de monorepo:
  ```
  tradefightclub/
  ├── apps/
  │   ├── web/              # Next.js frontend
  │   ├── api/              # NestJS REST API
  │   ├── realtime/         # WebSocket server
  │   └── jobs/             # Scheduled jobs
  ├── packages/
  │   ├── shared/           # Types, constants, events
  │   ├── db/               # Prisma schema + client
  │   ├── logger/           # Structured logging
  │   ├── ui/               # Shared React components (opcional)
  │   └── tsconfig/         # Shared TS configs
  ├── turbo.json
  ├── package.json
  └── .env.example
  ```
- [x] Configurar TypeScript base configs
- [x] Configurar ESLint + Prettier compartido
- [x] Configurar Turborepo pipelines (dev, build, lint, test)
- [x] Crear .env.example con todas las variables necesarias

### 0.2 Base de Datos
- [x] Instalar Prisma en `packages/db`
- [x] Crear schema inicial (todas las tablas)
- [ ] Configurar migraciones (requiere DB corriendo)
- [ ] Generar Prisma Client (requiere DB corriendo)
- [ ] Seed de datos de prueba (opcional dev)

### 0.3 Paquetes Compartidos
- [x] `packages/shared`: tipos, constantes, eventos
- [x] `packages/logger`: structured logger con contexto
- [x] Exportar todo correctamente

---

## Fase 1: Observabilidad (Sección 9 Master-doc)

> **Prioridad**: ALTA - Se implementa ANTES del código de negocio

### 1.1 Structured Logger
- [x] Crear interfaz `LogContext` con campos obligatorios:
  - `service`, `env`, `timestamp`, `level`, `event`, `message`
  - `request_id`, `trace_id`, `user_id`, `fight_id`, `pacifica_account_id`
  - `context`
- [x] Implementar logger que emite JSON
- [x] Regla: NUNCA loguear secretos/tokens/keys

### 1.2 Event Taxonomy (Sección 9.3)
- [x] Definir constantes para todos los eventos:
  - Auth: `auth.connect.*`, `pacifica.session.*`, `pacifica.ws.*`, `pacifica.api.*`
  - Fights: `fight.create`, `fight.join.*`, `fight.start`, `fight.tick`, `fight.finish`, `fight.cancel.*`
  - Orders: `order.place.*`, `order.cancel.*`, `fill.received`, `position.updated`
  - Scoring: `scoring.recalc.*`, `scoring.snapshot.*`
  - WS: `ws.client.*`, `ws.event.*`
  - Jobs: `job.leaderboard.*`, `job.reconcile.*`

### 1.3 Rejection Codes (Sección 9.4)
- [x] Fight join rejections: `FIGHT_NOT_FOUND`, `FIGHT_ALREADY_LIVE`, `FIGHT_FULL`, `NO_PACIFICA_CONNECTION`
- [x] Order rejections: `INVALID_LEVERAGE`, `INVALID_SIZE`, `PACIFICA_ERROR`, `RATE_LIMITED`

### 1.4 Sentry Integration (Sección 9.5)
- [ ] Instalar `@sentry/node`
- [ ] Configurar para cada servicio (api, realtime, job)
- [ ] Habilitar performance tracing:
  - HTTP transactions
  - WS message handler spans
  - Job spans
- [ ] Configurar tags: `service`, `env`, `fight_id`, `user_id`, `symbol`
- [ ] Configurar breadcrumbs para acciones críticas

### 1.5 Request Correlation
- [ ] Middleware para generar/propagar `request_id`
- [ ] AsyncLocalStorage para contexto en toda la request
- [ ] Header `x-request-id` en responses

---

## Fase 2: Pacifica Client (Server-Side)

> **Referencia**: `Pacifica-API.md`, `Pacifica-Builder-Program.md`

### 2.1 Pacifica REST Client
- [ ] Clase `PacificaClient` con métodos para cada endpoint
- [ ] Configuración base URL: `https://api.pacifica.fi`
- [ ] Manejo de errores y rate limiting
- [ ] Logging de todas las llamadas (`pacifica.api.*`)

### 2.2 Signature Implementation (Ed25519)
- [ ] Implementar signing según Pacifica docs:
  1. Crear signature header (`timestamp`, `expiry_window`, `type`)
  2. Combinar header + data
  3. Recursive sort JSON keys
  4. Compact JSON (no whitespace)
  5. UTF-8 bytes → Ed25519 sign → Base58
- [ ] Función helper `signPacificaRequest(keypair, operationType, data)`
- [ ] Tests para verificar signatures válidas

### 2.3 Pacifica REST Endpoints
- [ ] **Markets (no auth)**:
  - `GET /api/v1/info` → Market info
  - `GET /api/v1/info/prices` → All prices
  - `GET /api/v1/book?symbol=` → Orderbook
  - `GET /api/v1/kline` → Historical candles
  - `GET /api/v1/trades?symbol=` → Recent trades
- [ ] **Account (auth required)**:
  - `GET /api/v1/account?account=` → Account summary
  - `GET /api/v1/positions?account=` → Positions
  - `GET /api/v1/orders?account=` → Open orders
  - `GET /api/v1/trades/history?account=` → Trade history (fills)
  - `GET /api/v1/account/settings?account=` → Leverage settings
- [ ] **Orders (signed)**:
  - `POST /api/v1/orders/create_market` → Market order
  - `POST /api/v1/orders/create` → Limit order
  - `POST /api/v1/orders/cancel` → Cancel order
  - `POST /api/v1/orders/cancel_all` → Cancel all
- [ ] **Builder Code**:
  - `POST /api/v1/account/builder_codes/approve` → Approve builder
  - `GET /api/v1/account/builder_codes/approvals` → Check approvals

### 2.4 Pacifica WebSocket Client
- [ ] Conexión a Pacifica WS
- [ ] Subscriptions:
  - `prices` → All symbol prices
  - `account_positions` → User positions
  - `account_orders` → User orders
  - `account_info` → User account updates
  - `trades` → Market trades (for feed)
  - `candle` → Real-time candles
- [ ] Reconnection logic con backoff
- [ ] Logging (`pacifica.ws.connect`, `pacifica.ws.disconnect`)

---

## Fase 3: API Service (apps/api)

> **Referencia**: Sección 7 Master-doc
> **Status**: ✅ COMPLETADO

### 3.1 NestJS Setup
- [x] Crear app NestJS en `apps/api`
- [x] Configurar módulos base
- [x] Middleware: request ID, logging, error handling
- [ ] Sentry integration
- [x] Health check endpoint

### 3.2 Auth Module
- [x] `POST /auth/pacifica/connect`
  - Input: Signed message proving wallet ownership
  - Verificar signature
  - Crear/actualizar `PacificaConnection` en DB
  - Log: `auth.connect.start`, `auth.connect.success/failure`
- [x] Middleware de autenticación (verificar user + pacifica connection)
- [x] Guard para rutas protegidas

### 3.3 Markets Module (Proxy a Pacifica)
- [x] `GET /markets` → Lista de mercados
- [x] `GET /markets/prices` → Precios actuales
- [x] `GET /markets/:symbol/orderbook` → Orderbook
- [x] `GET /markets/:symbol/kline` → Historical candles
- [ ] Cache opcional (Redis) para reducir calls a Pacifica

### 3.4 Account Module
- [x] `GET /account/summary` → Equity, available, margin
- [x] `GET /positions` → Posiciones abiertas
- [x] `GET /orders/open` → Órdenes abiertas
- [x] `GET /fills` → Trade history (query param: `since`)
- [x] Todos requieren auth, proxy a Pacifica con account del user

### 3.5 Orders Module
- [x] `POST /orders` → Place order
  - Validaciones (Sección 9.4):
    - User conectado
    - Symbol válido
    - Leverage dentro de [1, max_leverage]
    - Size > 0 y dentro de límites
    - Rate limiting interno
  - Sign request server-side
  - Incluir `builder_code` en todas las órdenes
  - Log: `order.place.request`, `order.place.accepted/rejected`
- [x] `DELETE /orders/:id` → Cancel order
  - Log: `order.cancel.request`, `order.cancel.success/failure`
- [x] `DELETE /orders` → Cancel all orders

### 3.6 Fights Module
- [x] `POST /fights` → Crear fight
  - Input: `{ durationMinutes, stakeUsdc }`
  - Validar duración en [5, 15, 30, 60, 120, 240]
  - Validar stake en [100, 250, 500, 1000, 2500, 5000]
  - Crear fight con status `WAITING`
  - Crear participant (creator) con slot 'A'
  - Log: `fight.create`
- [x] `POST /fights/:id/join` → Unirse a fight
  - Validaciones (Sección 9.4):
    - Fight existe
    - Status == WAITING
    - Usuario no es duplicado
    - Opponent slot libre
    - User tiene pacifica_connection válida
  - Crear participant con slot 'B'
  - Cambiar status a `LIVE`, set `startedAt`
  - Log: `fight.join.attempt`, `fight.join.success/rejected`
- [x] `GET /fights` → Listar fights
  - Filtros: status, pagination
- [x] `GET /fights/:id` → Detalle de fight

### 3.7 Users Module
- [x] `GET /users/:id/profile` → Perfil básico
  - Handle, avatar
  - Stats agregados (wins, losses, draws)

### 3.8 Leaderboard Module
- [x] `GET /leaderboard?range=weekly|all_time`
  - Lee de `LeaderboardSnapshot`
  - Sección 11: weekly y all_time, draws no suman win/loss

---

## Fase 4: Realtime Service (apps/realtime)

> **Referencia**: Sección 8 Master-doc, Sección 4 (HUD)
> **Status**: ✅ COMPLETADO

### 4.1 Setup
- [x] Crear app Node.js en `apps/realtime`
- [x] WebSocket server (Socket.IO)
- [ ] Sentry integration
- [x] Conexión a DB (Prisma)

### 4.2 Pacifica Consumer
- [x] Conectar a Pacifica WS
- [x] Subscribir a channels por cada fight LIVE:
  - `account_positions` para ambos participantes
  - `prices` para mark prices
- [x] Procesar fills:
  - Verificar fill pertenece a participante
  - Verificar timestamp dentro de ventana del fight
  - Guardar en `FightTrade`
  - Log: `fill.received`

### 4.3 Fight Engine
- [x] State machine: WAITING → LIVE → FINISHED
- [x] Scoring loop (cada 1-2s para fights LIVE):
  - Calcular para cada participante:
    ```
    RealizedPnL = sum(FightTrades.pnl)
    UnrealizedPnL = sum(positions * (markPrice - entryPrice))
    Fees = sum(FightTrades.fee)
    Funding = sum(positions.funding)
    EquityVirtual = Stake + RealizedPnL + UnrealizedPnL - Fees - Funding
    PnL% = (EquityVirtual / Stake) - 1
    ScoreUSDC = Stake × PnL%
    ```
  - Validar no NaN/Infinity
  - Determinar leader
  - Log: `scoring.recalc.start/success/failure`
- [x] Snapshot writer:
  - Guardar `FightSnapshot` cada tick
  - Log: `scoring.snapshot.write`
- [x] Fight finish handler:
  - Detectar cuando `now >= endedAt`
  - Calcular final scores
  - Determinar winner (o draw si empate)
  - Actualizar fight status a FINISHED
  - Actualizar participants con final scores
  - Log: `fight.finish`

### 4.4 WS Broadcaster
- [x] Endpoint: `WS /ws/fights/:fight_id`
- [ ] Autenticación en connect
- [x] Eventos a emitir (Sección 8):
  - `FIGHT_STATE` → Al conectar, estado completo
  - `FIGHT_STARTED` → Cuando se une el 2do participante
  - `TRADE_EVENT` → Por cada fill
  - `PNL_TICK` → Cada 1-2s con scores actuales
  - `LEAD_CHANGED` → Cuando cambia el líder
  - `FIGHT_FINISHED` → Al terminar
  - `ERROR` → En caso de error
- [x] Log: `ws.client.connect`, `ws.client.disconnect`, `ws.event.sent`

---

## Fase 5: Jobs Service (apps/jobs)

> **Referencia**: Sección 5.2 Master-doc
> **Status**: ✅ COMPLETADO

### 5.1 Setup
- [x] Crear app Node.js en `apps/jobs`
- [x] Scheduler (node-cron)
- [ ] Sentry integration
- [x] Conexión a DB (Prisma)

### 5.2 Leaderboard Refresh Job
- [x] Frecuencia: cada 5 minutos
- [x] Lógica:
  - Query fights FINISHED
  - Agregar stats por usuario
  - Weekly: solo última semana
  - All time: histórico completo
  - Calcular ranks
  - Upsert `LeaderboardSnapshot`
- [x] Log: `job.leaderboard.refresh.start/success/failure`

### 5.3 Stale Fight Cleanup Job
- [x] Frecuencia: cada 1 minuto
- [x] Lógica:
  - Buscar fights WAITING con `createdAt` > 15 min
  - Marcar como CANCELLED
- [x] Log: `fight.cancel.stale`

### 5.4 Fill Reconciliation Job
- [x] Frecuencia: cada 1 minuto
- [x] Lógica:
  - Para cada fight LIVE que debería haber terminado
  - Calcular scores finales
  - Actualizar fight status a FINISHED
- [x] Log: `job.reconcile.fights.start/success/failure`

---

## Fase 6: Frontend (apps/web)

> **Referencia**: Sección 3, 4 Master-doc
> **Status**: ✅ ESTRUCTURA BASE COMPLETADA

### 6.1 Next.js Setup
- [x] Crear app Next.js 14 (App Router)
- [x] Configurar TailwindCSS
- [x] Instalar y configurar Solana Wallet Adapter
- [x] Configurar providers (Wallet, QueryClient, etc.)
- [x] Layout base con navegación
- [ ] Sentry frontend integration

### 6.2 Autenticación & Wallet
- [x] Componente WalletConnect button (WalletProvider)
- [ ] Hook `useAuth` para estado de autenticación
- [ ] PacificaAccountGuard - verificar cuenta Pacifica
- [ ] Builder code approval flow
- [ ] Persistencia de sesión

### 6.3 Pages Structure
- [x] `/` - Landing/Home (con FightList básico)
- [ ] `/lobby` - Lista de fights + crear (pendiente)
- [ ] `/fight/[id]` - Fight terminal (pendiente)
- [ ] `/profile/[id]` - User profile (pendiente)
- [ ] `/leaderboard` - Rankings (pendiente)

### 6.4 Trading Terminal (Sección 3)
- [ ] **Market Header (3.1)**:
  - Selector de mercado (dropdown)
  - Last price + 24h % change
  - 24h high/low, volume
  - Open interest
  - Funding rate + countdown to next
  - Settings dropdown
- [ ] **Chart (3.2)**:
  - TradingView Lightweight Charts integration
  - OHLC candles + volume bars
  - Timeframe selector: 1m/5m/15m/1h/4h/1D
  - Indicadores: SMA, EMA, RSI
  - Crosshair con precio/tiempo
- [ ] **Orderbook (3.3)**:
  - Bids (green) / Asks (red) lista
  - Size y total acumulado
  - Spread indicator
  - Grouping step selector
  - Toggle unidades USD/token
  - Depth visualization
- [ ] **Account Panel (3.4)**:
  - Connection status indicator
  - Account equity
  - Available balance
  - Unrealized PnL
  - Margin ratio bar
- [ ] **Order Entry (3.5)**:
  - Long/Short toggle buttons
  - Market/Limit order type
  - Size input + unit selector
  - Quick size buttons: 25/50/75/100%
  - Leverage slider (1 → max_leverage)
  - Order breakdown:
    - Order value
    - Margin required
    - Est. liquidation price
    - Est. fees
  - Submit order button
- [ ] **Bottom Tabs (3.6)**:
  - Positions tab:
    - Lista de posiciones abiertas
    - PnL por posición
    - Close/Reduce buttons
  - Open Orders tab:
    - Lista de órdenes pendientes
    - Cancel individual / Cancel all
  - Trade History tab:
    - Fills recientes
    - Timestamp, symbol, side, size, price, fee
  - Funding widget

### 6.5 Fight Terminal HUD (Sección 4)
- [ ] **Header**:
  - Player A vs Player B
  - Handles + avatars
  - Fight status badge
- [ ] **Timer**:
  - Countdown grande
  - Progress bar visual
- [ ] **Score Display**:
  - PnL% para cada jugador
  - ScoreUSDC para cada jugador
  - Trades count
  - Visual de quién va ganando
- [ ] **Leader Indicator**:
  - Crown/highlight en el líder
  - Animación en lead change
- [ ] **Fight Feed**:
  - Lista de acciones recientes
  - Trade events
  - Lead changes
  - Timestamps

### 6.6 WebSocket Integration
- [ ] Hook `useFightWebSocket(fightId)`
- [ ] Conexión a `/ws/fights/:fight_id`
- [ ] Event handlers:
  - `FIGHT_STATE`
  - `FIGHT_STARTED`
  - `TRADE_EVENT`
  - `PNL_TICK`
  - `LEAD_CHANGED`
  - `FIGHT_FINISHED`
  - `ERROR`
- [ ] Reconnection con exponential backoff
- [ ] Connection status indicator
- [ ] Zustand/Context para state management

### 6.7 Lobby
- [ ] Lista de fights WAITING
  - Cards con: creator, duration, stake, tiempo esperando
  - Filtros por duration/stake
- [ ] Crear fight:
  - Duration selector
  - Stake selector
  - Create button
- [ ] Join fight button
- [ ] Mis fights activos

### 6.8 Profile & Leaderboard
- [ ] **Profile page**:
  - Avatar + handle
  - Stats: wins, losses, draws
  - Total PnL
  - Fight history
- [ ] **Leaderboard page**:
  - Toggle: Weekly / All Time
  - Tabla con rank, user, wins, losses, PnL
  - Tu posición destacada
  - Pagination

### 6.9 UI Components (packages/ui o local)
- [ ] Button variants
- [ ] Input fields
- [ ] Select/Dropdown
- [ ] Slider
- [ ] Modal
- [ ] Toast notifications
- [ ] Loading states
- [ ] Error states
- [ ] Tabs component
- [ ] Card component
- [ ] Avatar component
- [ ] Badge component

---

## Fase 7: Testing & QA

### 7.1 Unit Tests
- [ ] Pacifica client (mocked)
- [ ] Scoring calculations
- [ ] Fight state machine
- [ ] Signature generation

### 7.2 Integration Tests
- [ ] API endpoints
- [ ] WebSocket events
- [ ] Database operations

### 7.3 E2E Tests
- [ ] Complete fight flow
- [ ] Order placement
- [ ] Leaderboard update

---

## Fase 8: Deployment

### 8.1 Infrastructure
- [ ] PostgreSQL managed (AWS RDS / Supabase / etc)
- [ ] Secret Manager para Pacifica keys
- [ ] Redis (opcional, para cache)

### 8.2 Services
- [ ] API service deployment
- [ ] Realtime service deployment
- [ ] Jobs service deployment

### 8.3 Monitoring
- [ ] Sentry project configurado
- [ ] Log aggregation (CloudWatch / Datadog / etc)
- [ ] Alertas críticas

---

## Checklist Final (Sección 10 Master-doc)

- [ ] Todos los endpoints críticos loguean `request_id`, `user_id`, `fight_id`
- [ ] Todos los cambios de estado del fight generan logs `fight.*`
- [ ] Todas las órdenes generan `order.place.*` y `fill.received`
- [ ] Sentry captura errores backend + frontend
- [ ] Sentry captura performance traces
- [ ] Sentry tiene breadcrumbs de acciones críticas
- [ ] Dashboard interno funcional:
  - Filtros por fight_id, user_id, event
  - Quick view de últimos 500 eventos

---

## Notas de Implementación

### Constantes (de Master-doc)

```typescript
// Durations (Sección 2.2)
export const FIGHT_DURATIONS_MINUTES = [5, 15, 30, 60, 120, 240] as const;

// Stakes (Sección 2.3)
export const FIGHT_STAKES_USDC = [100, 250, 500, 1000, 2500, 5000] as const;

// Leverage
export const MIN_LEVERAGE = 1;
// MAX_LEVERAGE viene de Pacifica API por mercado

// PNL Tick interval (Sección 4.2)
export const PNL_TICK_INTERVAL_MS = 1000; // o 2000 si limitaciones

// Candle intervals disponibles en Pacifica
export const CANDLE_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '12h', '1d'] as const;
```

### Scoring Formula (Sección 2.5)

```typescript
function calculateScore(stake: number, realizedPnl: number, unrealizedPnl: number, fees: number, funding: number) {
  const equityVirtual = stake + realizedPnl + unrealizedPnl - fees - funding;
  const pnlPercent = (equityVirtual / stake) - 1;
  const scoreUsdc = stake * pnlPercent;

  return { equityVirtual, pnlPercent, scoreUsdc };
}
```

---

## Log de Cambios

| Fecha | Cambio |
|-------|--------|
| 2026-01-02 | Documento inicial creado |
| 2026-01-02 | ✅ Fase 0: Setup completo (Turborepo, packages) |
| 2026-01-02 | ✅ Fase 1: Observabilidad parcial (Logger, Events, Rejections) |
| 2026-01-02 | ✅ Fase 3: API Service completo (NestJS) |
| 2026-01-02 | ✅ Fase 4: Realtime Service completo (Socket.IO) |
| 2026-01-02 | ✅ Fase 5: Jobs Service completo (node-cron) |
| 2026-01-02 | ✅ Fase 6: Frontend estructura base (Next.js 14 + Wallet) |
| 2026-01-02 | 🔄 Todo el monorepo compila correctamente |
