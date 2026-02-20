# TradeFightClub - Documentación Técnica

## Índice
1. [Estructura del Proyecto](#1-estructura-del-proyecto)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Base de Datos](#3-base-de-datos)
4. [API Backend](#4-api-backend)
5. [Autenticación](#5-autenticación)
6. [WebSockets y Real-time](#6-websockets-y-real-time)
7. [State Management](#7-state-management)
8. [Comunicación Frontend-Backend](#8-comunicación-frontend-backend)
9. [Jobs en Background](#9-jobs-en-background)
10. [Variables de Entorno](#10-variables-de-entorno)

---

## 1. Estructura del Proyecto

### Monorepo con Turborepo

```
tradefightclub/
├── apps/
│   ├── web/              # Next.js 14 - Frontend
│   ├── api/              # NestJS - Backend API
│   ├── realtime/         # Socket.io - Real-time Engine
│   └── jobs/             # Node-cron - Background Jobs
├── packages/
│   ├── db/               # Prisma ORM y cliente de base de datos
│   ├── shared/           # Tipos compartidos, constantes, eventos
│   ├── logger/           # Sistema de logging estructurado
│   └── tsconfig/         # Configuraciones TypeScript compartidas
```

**Herramientas del Monorepo:**
- **Build Tool**: Turborepo con npm workspaces
- **Package Manager**: npm 10.2.0
- **Caching**: Turbo caching para optimización de builds
- **Packages internos**: Prefijo `@tfc/` (ej: `@tfc/db`, `@tfc/shared`)

---

## 2. Stack Tecnológico

### Frontend (apps/web)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 14.2.20 | Framework React con App Router |
| React | 18.3.1 | Librería UI |
| TypeScript | 5.7.2 | Tipado estático |
| TailwindCSS | 3.4.17 | Framework CSS utility-first |
| Zustand | 5.0.1 | State management |
| TanStack React Query | 5.90.16 | Data fetching y caching |
| socket.io-client | 4.8.1 | Cliente WebSocket |
| lightweight-charts | 5.1.0 | Gráficos financieros |
| Sonner | 2.0.7 | Toast notifications |

**Integración Solana/Wallets:**
| Paquete | Versión |
|---------|---------|
| @solana/web3.js | 1.98.0 |
| @solana/wallet-adapter-react | 0.15.35 |
| @solana/wallet-adapter-react-ui | 0.9.35 |
| @solana/wallet-adapter-wallets | 0.19.32 |
| bs58 | 5.0.0 |

### Backend API (apps/api)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| NestJS | 10.4.15 | Framework backend |
| Express | (via NestJS) | HTTP server |
| Prisma Client | 6.1.0 | ORM |
| @nestjs/jwt | 10.2.0 | JWT authentication |
| @nestjs/passport | 10.0.3 | Passport integration |
| passport-jwt | 4.0.1 | JWT strategy |
| class-validator | 0.14.1 | Validación de DTOs |
| class-transformer | 0.5.1 | Transformación de objetos |
| RxJS | 7.8.1 | Programación reactiva |
| @sentry/node | 8.45.0 | Error tracking |

**Criptografía:**
| Paquete | Uso |
|---------|-----|
| tweetnacl | 1.0.3 | Ed25519 signing |
| @noble/ed25519 | 2.1.0 | Ed25519 (preferido) |
| @scure/base | 1.1.9 | Base58/Base64 encoding |

### Real-time Engine (apps/realtime)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Socket.io | 4.8.1 | WebSocket server |
| Node.js | 20+ | Runtime |
| tsx | 4.19.2 | TypeScript execution |
| dotenv | 16.4.7 | Environment variables |

### Job Processor (apps/jobs)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| node-cron | 3.0.3 | Job scheduling |
| Prisma Client | 6.1.0 | Database access |

### Base de Datos

| Sistema | Uso |
|---------|-----|
| PostgreSQL | Base de datos principal |
| Prisma | 6.1.0 | ORM y migraciones |

---

## 3. Base de Datos

### Schema Prisma - Modelos Principales

#### User (Usuario)
```prisma
model User {
  id            String   @id @default(uuid())
  handle        String   @unique
  walletAddress String?  @unique @map("wallet_address")
  avatarUrl     String?  @map("avatar_url")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relaciones
  pacificaConnection   PacificaConnection?
  fightParticipants    FightParticipant[]
  createdFights        Fight[]
  leaderboardSnapshots LeaderboardSnapshot[]
  trades               Trade[]
  notifications        Notification[]
}
```

#### PacificaConnection (Conexión con Pacifica)
```prisma
model PacificaConnection {
  id                  String   @id @default(uuid())
  userId              String   @unique @map("user_id")
  accountAddress      String   @map("account_address")
  vaultKeyReference   String?  @map("vault_key_reference") // Ref a AWS Secrets
  builderCodeApproved Boolean  @default(false) @map("builder_code_approved")
  isActive            Boolean  @default(true) @map("is_active")
  connectedAt         DateTime @default(now()) @map("connected_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### Fight (Pelea/Competencia)
```prisma
model Fight {
  id              String       @id @default(uuid())
  creatorId       String       @map("creator_id")
  durationMinutes Int          @map("duration_minutes") // 5, 15, 30, 60, 120, 240
  stakeUsdc       Int          @map("stake_usdc")       // 100, 250, 500, 1000, 2500, 5000
  status          FightStatus  @default(WAITING)       // WAITING, LIVE, FINISHED, CANCELLED
  winnerId        String?      @map("winner_id")
  isDraw          Boolean      @default(false) @map("is_draw")
  createdAt       DateTime     @default(now()) @map("created_at")
  startedAt       DateTime?    @map("started_at")
  endedAt         DateTime?    @map("ended_at")

  // Relaciones
  creator      User               @relation(fields: [creatorId], references: [id])
  participants FightParticipant[]
  snapshots    FightSnapshot[]
  fightTrades  FightTrade[]
}
```

#### FightParticipant (Participante de Pelea)
```prisma
model FightParticipant {
  id                     String   @id @default(uuid())
  fightId                String   @map("fight_id")
  userId                 String   @map("user_id")
  slot                   String   // 'A' o 'B'
  joinedAt               DateTime @default(now()) @map("joined_at")
  initialPositions       Json?    @map("initial_positions")
  maxExposureUsed        Decimal? @map("max_exposure_used")
  finalPnlPercent        Decimal? @map("final_pnl_percent")
  finalScoreUsdc         Decimal? @map("final_score_usdc")
  tradesCount            Int      @default(0) @map("trades_count")
  externalTradesDetected Boolean  @default(false)
  externalTradeIds       String[] @default([])
}
```

#### FightTrade (Trades durante peleas)
```prisma
model FightTrade {
  id                String   @id @default(uuid())
  fightId           String   @map("fight_id")
  participantUserId String   @map("participant_user_id")
  pacificaHistoryId String   @map("pacifica_history_id")
  pacificaOrderId   String?  @map("pacifica_order_id")
  symbol            String
  side              String   // BUY o SELL
  amount            Decimal
  price             Decimal
  fee               Decimal  @default(0)
  pnl               Decimal  @default(0)
  leverage          Int?
  executedAt        DateTime @map("executed_at")
  recordedAt        DateTime @default(now()) @map("recorded_at")
}
```

#### Trade (Todos los trades - métricas)
```prisma
model Trade {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  pacificaHistoryId String   @unique @map("pacifica_history_id")
  pacificaOrderId   String?  @map("pacifica_order_id")
  symbol            String
  side              String
  amount            Decimal
  price             Decimal
  fee               Decimal  @default(0)
  pnl               Decimal  @default(0)
  leverage          Int?
  fightId           String?  @map("fight_id")
  executedAt        DateTime @map("executed_at")
  createdAt         DateTime @default(now()) @map("created_at")
}
```

#### LeaderboardSnapshot (Rankings)
```prisma
model LeaderboardSnapshot {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  range         String   // 'weekly' o 'all_time'
  totalFights   Int      @default(0) @map("total_fights")
  wins          Int      @default(0)
  losses        Int      @default(0)
  draws         Int      @default(0)
  totalPnlUsdc  Decimal  @default(0) @map("total_pnl_usdc")
  avgPnlPercent Decimal  @default(0) @map("avg_pnl_percent")
  rank          Int?
  calculatedAt  DateTime @default(now()) @map("calculated_at")

  @@unique([userId, range])
}
```

#### WeeklyPrizePool y WeeklyPrize
```prisma
model WeeklyPrizePool {
  id                 String   @id @default(uuid())
  weekStartDate      DateTime @map("week_start_date")
  weekEndDate        DateTime @map("week_end_date")
  totalFeesCollected Decimal  @default(0) @map("total_fees_collected")
  totalPrizePool     Decimal  @default(0) @map("total_prize_pool") // 10% de fees
  isFinalized        Boolean  @default(false) @map("is_finalized")
  isDistributed      Boolean  @default(false) @map("is_distributed")

  prizes WeeklyPrize[]
}

model WeeklyPrize {
  id              String  @id @default(uuid())
  prizePoolId     String  @map("prize_pool_id")
  userId          String  @map("user_id")
  rank            Int     // 1, 2, o 3
  prizePercentage Decimal // 5.00, 3.00, o 2.00
  prizeAmount     Decimal @map("prize_amount")
  totalPnlUsdc    Decimal @map("total_pnl_usdc")
  totalFights     Int     @map("total_fights")
  wins            Int
  userHandle      String  @map("user_handle")
  status          String  @default("PENDING") // PENDING, EARNED, DISTRIBUTED
}
```

#### Notification (Notificaciones)
```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  type      String   // TRADE, ORDER, FIGHT, SYSTEM
  title     String
  message   String
  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([userId, createdAt])
}
```

#### TfcOrderAction (Auditoría de órdenes)
```prisma
model TfcOrderAction {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  walletAddress     String   @map("wallet_address")
  actionType        String   @map("action_type") // MARKET_ORDER, LIMIT_ORDER, etc.
  symbol            String?
  side              String?
  orderType         String?  @map("order_type")
  amount            Decimal?
  price             Decimal?
  takeProfit        Decimal? @map("take_profit")
  stopLoss          Decimal? @map("stop_loss")
  pacificaOrderId   String?  @map("pacifica_order_id")
  pacificaHistoryId String?  @map("pacifica_history_id")
  filledAmount      Decimal? @map("filled_amount")
  filledPrice       Decimal? @map("filled_price")
  fee               Decimal?
  pnl               Decimal?
  leverage          Int?
  fightId           String?  @map("fight_id")
  success           Boolean  @default(true)
  errorMessage      String?  @map("error_message")
  createdAt         DateTime @default(now()) @map("created_at")
}
```

---

## 4. API Backend

### Estructura de Módulos NestJS

**Puerto**: 3000 (configurable via `API_PORT`)
**Prefijo Global**: `/api`

#### Módulos Principales:

1. **AuthModule** - Autenticación
   - POST `/api/auth/connect` - Login con wallet Solana
   - POST `/api/auth/pacifica/link` - Vincular cuenta Pacifica
   - GET `/api/auth/pacifica/me` - Obtener conexión Pacifica

2. **FightsModule** - Peleas
   - POST `/api/fights` - Crear pelea
   - GET `/api/fights` - Listar peleas
   - GET `/api/fights/:id` - Detalle de pelea
   - POST `/api/fights/:id/join` - Unirse a pelea
   - GET `/api/fights/:id/trades` - Trades de una pelea
   - GET `/api/fights/:id/positions` - Posiciones en pelea
   - GET `/api/fights/my-active` - Mis peleas activas
   - GET `/api/fights/stake-info` - Info de stake

3. **AccountModule** - Cuenta
   - GET `/api/account/summary` - Resumen (equity, balance, margin)
   - GET `/api/account/positions` - Posiciones actuales
   - GET `/api/account/orders/open` - Órdenes abiertas
   - GET `/api/account/leverage` - Leverage actual
   - POST `/api/account/withdraw` - Retirar fondos

4. **OrdersModule** - Órdenes
   - Colocar órdenes market/limit
   - Cancelar órdenes
   - Actualizar leverage
   - Gestión de TP/SL

5. **MarketsModule** - Mercados
   - GET `/api/markets/info` - Metadata de mercados
   - GET `/api/markets/prices` - Precios actuales
   - GET `/api/markets/orderbook` - Libro de órdenes
   - GET `/api/markets/candles` - Datos OHLCV

6. **UsersModule** - Usuarios
   - Perfil de usuario
   - Búsqueda por handle
   - Gestión de avatar

7. **LeaderboardModule** - Rankings
   - GET `/api/leaderboard/weekly` - Ranking semanal
   - GET `/api/leaderboard/all-time` - Ranking histórico

8. **NotificationsModule** - Notificaciones
   - GET `/api/notifications` - Listar notificaciones
   - POST `/api/notifications` - Crear notificación
   - GET `/api/notifications/unread-count` - Contador no leídas
   - POST `/api/notifications/:id/read` - Marcar como leída
   - POST `/api/notifications/read-all` - Marcar todas como leídas

### Middleware Global

- **RequestIdMiddleware**: Añade correlation IDs (X-Request-ID)
- **LoggingMiddleware**: Logging estructurado de requests
- **ValidationPipe**: Validación de DTOs con whitelist
- **CORS**: Configurable via `CORS_ORIGINS`
- **Sentry**: Error tracking

---

## 5. Autenticación

### Flujo de Autenticación

```
1. Frontend (Wallet Adapter)
   │
   ▼
2. Usuario firma mensaje con wallet Solana
   │
   ▼
3. Enviar firma a POST /api/auth/connect
   │
   ▼
4. Backend verifica firma Ed25519
   │
   ▼
5. Crear/actualizar registro User
   │
   ▼
6. Verificar si existe cuenta Pacifica (mismo wallet)
   │
   ▼
7. Auto-vincular si existe (read-only)
   │
   ▼
8. Generar JWT token (sub: userId, walletAddress)
   │
   ▼
9. Retornar JWT + User + pacificaConnected
   │
   ▼
10. Frontend almacena en Zustand (persistido en localStorage)
```

### JWT Strategy

- **Algoritmo**: HS256
- **Secreto**: `JWT_SECRET` (env var)
- **Payload**: `{ sub: userId, walletAddress }`
- **Header**: `Authorization: Bearer <token>`

### Verificación de Firma Solana

```typescript
// Usando @noble/ed25519
import { verify } from '@noble/ed25519';

const isValid = await verify(
  signature,           // Firma del usuario (bytes)
  messageBytes,        // Mensaje firmado
  publicKeyBytes       // Public key del wallet
);
```

---

## 6. WebSockets y Real-time

### Servidor Real-time

**Puerto**: 3002 (configurable via `REALTIME_PORT`)
**Tecnología**: Socket.io

### Arquitectura

```
┌─────────────────┐
│    Frontend     │
│  (socket.io-    │
│     client)     │
└────────┬────────┘
         │
    WebSocket
         │
         ▼
┌─────────────────────────────────┐
│  Real-time Engine (Port 3002)   │
│  ├── Socket.io Server           │
│  ├── FightEngine                │
│  └── Internal HTTP API          │
└────────────┬────────────────────┘
             │
        HTTP (internal)
             │
             ▼
┌────────────────────────────────┐
│     Backend API (Port 3000)    │
└────────────────────────────────┘
```

### Eventos WebSocket

#### Fight Room Events (Server → Client)

| Evento | Descripción |
|--------|-------------|
| `FIGHT_STATE` | Estado inicial de la pelea |
| `FIGHT_STARTED` | La pelea comenzó |
| `TRADE_EVENT` | Se ejecutó un trade |
| `PNL_TICK` | Actualización de PnL (cada 1s) |
| `LEAD_CHANGED` | Cambió el líder |
| `FIGHT_FINISHED` | Pelea terminada |
| `STAKE_INFO` | Info de exposición/capital |
| `EXTERNAL_TRADES_DETECTED` | Trades fuera de TFC |
| `ERROR` | Error |

#### Arena Events (Server → Client, broadcast)

| Evento | Descripción |
|--------|-------------|
| `arena:fight_created` | Nueva pelea creada |
| `arena:fight_updated` | Pelea actualizada |
| `arena:fight_started` | Pelea iniciada |
| `arena:fight_ended` | Pelea terminada |
| `arena:fight_deleted` | Pelea eliminada |
| `arena:pnl_tick` | PnL live de todas las peleas |

#### Platform Events

| Evento | Descripción |
|--------|-------------|
| `platform:stats` | Estadísticas de la plataforma |

#### Client → Server Events

| Evento | Descripción |
|--------|-------------|
| `arena:subscribe` | Suscribirse a eventos del arena |
| `arena:unsubscribe` | Desuscribirse |
| `join_fight` | Unirse a sala de pelea |
| `leave_fight` | Salir de sala de pelea |

### FightEngine

El FightEngine mantiene las peleas activas en memoria y calcula PnL cada segundo:

```typescript
// Loop principal
setInterval(() => {
  for (const fight of activeFights) {
    const pnlData = calculatePnL(fight);
    io.to(`fight:${fight.id}`).emit('PNL_TICK', pnlData);
  }
}, 1000);
```

---

## 7. State Management

### Zustand Stores

#### AuthStore
```typescript
interface AuthStore {
  token: string | null;
  user: { id: string; handle: string; avatarUrl?: string } | null;
  isAuthenticated: boolean;
  pacificaConnected: boolean;

  setAuth: (token: string, user: User, pacificaConnected: boolean) => void;
  setPacificaConnected: (connected: boolean) => void;
  clearAuth: () => void;
}
```
- **Persistencia**: localStorage con key `tfc-auth`

#### FightStore
```typescript
interface FightStore {
  currentFight: Fight | null;
  localPnl: { A: number; B: number };

  setCurrentFight: (fight: Fight) => void;
  updateScores: (scores: Scores) => void;
  updateLocalPnl: (pnl: LocalPnl) => void;
  clearCurrentFight: () => void;
}
```

#### GlobalSocketStore
```typescript
interface GlobalSocketStore {
  isConnected: boolean;
  activeFightsCount: number;
  fights: Map<string, Fight>;
  livePnl: Map<string, PnlData>;

  updateFight: (fight: Fight) => void;
  removeFight: (id: string) => void;
  updateLivePnl: (fightId: string, pnl: PnlData) => void;
}
```

### React Query

- **Stale Time**: 10 segundos
- **Refetch**: On window focus y mount
- **Retries**: 2 con exponential backoff

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 2,
    },
  },
});
```

---

## 8. Comunicación Frontend-Backend

### Diagrama de Flujo de Datos

```
┌─────────────────┐
│  Frontend Web   │ (Next.js + React + Zustand)
│  (Port 3001)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   HTTP    WebSocket
    │         │
    ▼         ▼
┌─────────────────────────────────┐
│  Real-time Engine (Port 3002)   │
└────────────┬────────────────────┘
             │
    ┌────────┴──────────┐
    │                   │
   HTTP              WebSocket
    │ (internal)        │ (arena)
    ▼                   ▼
┌────────────────────────────────┐
│  Backend API (Port 3000)       │
└────────────┬───────────────────┘
             │
    ┌────────┼─────────┬──────────┐
    │        │         │          │
    ▼        ▼         ▼          ▼
PostgreSQL Pacifica  AWS       Jobs
   (DB)     (API)   Secrets   Service
```

### Patrones de Comunicación

1. **REST API** (HTTP)
   - CRUD de entidades
   - Autenticación
   - Operaciones de trading

2. **WebSocket** (Socket.io)
   - Eventos en tiempo real
   - Actualizaciones de PnL
   - Notificaciones de arena

3. **Internal API** (Backend → Realtime)
   - Notificación de eventos
   - Sincronización de estado
   - Autenticado con `INTERNAL_API_KEY`

---

## 9. Jobs en Background

### Scheduled Tasks

| Job | Cron | Descripción |
|-----|------|-------------|
| Leaderboard Refresh | `*/5 * * * *` | Recalcula rankings cada 5 min |
| Stale Fight Cleanup | `* * * * *` | Cancela peleas WAITING >15 min |
| Fight Reconciliation | `* * * * *` | Finaliza peleas que deberían terminar |
| Prize Pool Finalization | `5 0 * * 0` | Finaliza pool semanal (Dom 00:05 UTC) |
| Current Prize Pool Update | `*/5 * * * *` | Actualiza pool actual cada 5 min |

### Ejemplo de Job

```typescript
import cron from 'node-cron';
import { prisma } from '@tfc/db';

// Leaderboard refresh - cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log('Refreshing leaderboard...');

  const stats = await prisma.fightParticipant.groupBy({
    by: ['userId'],
    where: { fight: { status: 'FINISHED' } },
    _count: { id: true },
    _sum: { finalScoreUsdc: true },
  });

  // Actualizar LeaderboardSnapshot...
});
```

---

## 10. Variables de Entorno

### Backend (.env)

```bash
# Base de Datos
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/db

# Autenticación
JWT_SECRET=tu-secreto-jwt-seguro

# Servidor
NODE_ENV=development|staging|production
API_PORT=3000
API_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3001,https://tudominio.com

# Real-time
REALTIME_URL=http://localhost:3002
REALTIME_PORT=3002
INTERNAL_API_KEY=clave-compartida-interna

# Pacifica
PACIFICA_API_URL=https://api.pacifica.xyz
PACIFICA_API_KEY=tu-api-key

# AWS (para vault keys)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:3002
```

---

## Resumen Arquitectónico

| Componente | Tecnología | Puerto | Función |
|------------|------------|--------|---------|
| Frontend | Next.js 14 | 3001 | UI, React Query, Zustand |
| Backend API | NestJS | 3000 | REST API, Auth, Business Logic |
| Real-time | Socket.io | 3002 | WebSocket, PnL Engine |
| Jobs | node-cron | - | Background tasks |
| Database | PostgreSQL | 5432 | Persistencia |

### Flujo de una Operación de Trading

1. **Usuario abre posición** en el frontend
2. **Frontend** envía POST a `/api/orders/market`
3. **Backend** firma request con Ed25519 y envía a Pacifica
4. **Pacifica** ejecuta la orden y retorna confirmación
5. **Backend** guarda `TfcOrderAction` y notifica a **Real-time**
6. **Real-time** emite `TRADE_EVENT` a la sala de pelea
7. **Frontend** recibe evento y actualiza UI
8. **FightEngine** recalcula PnL y emite `PNL_TICK`
9. **Frontend** actualiza scores en tiempo real
