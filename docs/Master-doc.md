Antes de empezar quiero remarcar que este doc fue echo con ChatGPT y posiblemente en el API no tenga info correcta.
Verifica siempre C:\Users\Lian Li\tradefightclub\Pacifica-API.md y C:\Users\Lian Li\tradefightclub\Pacifica-Builder-Program.md

Tambien evita el vibe coding o cualquier rastro de AI coding en este proyecto

MASTER DOC — Trading Fight Club (Pacifica Perps) — v1.1 (MVP + Observability) 0) Objetivo

Construir una plataforma de peleas públicas 1v1 de trading en perpetuals conectadas a Pacifica. Usuarios operan en vivo con un terminal completo y el sistema calcula ganador por PnL% y ScoreUSDC (stake virtual).

1. Alcance MVP
   1.1 Incluye

Conexión segura de cuenta Pacifica (server-side)

Lobby público: listar / crear / unirse a peleas

Fight lifecycle: WAITING → LIVE → FINISHED

Terminal de trading completo (funcionalidades del screenshot)

HUD competitivo en vivo (PnL%, ScoreUSDC, trades, timer)

Perfil de usuario básico

Leaderboard (Global + Weekly sin rewards)

Observabilidad: logs estructurados + Sentry con trazas

1.2 No incluye

premios (rewards)

apuestas / stake real / escrow

torneos / FFA

spectators (solo participantes)

TP/SL “server-side conditional” si Pacifica no lo soporta (queda para v2)

2. Reglas del juego
   2.1 Formato

1v1, público, cualquiera puede unirse mientras esté WAITING

Perps only + leverage

2.2 Duración

5m / 15m / 30m / 1h / 2h / 4h

2.3 Stake virtual (USDC)

100 / 250 / 500 / 1000 / 2500 / 5000 USDC

No bloquea fondos. Solo normaliza score.

2.4 Markets

El usuario puede tradear cualquier perp disponible.

Los mismos fills pueden contribuir a múltiples fights (por ventana temporal).

2.5 Cálculo de score

EquityVirtual = Stake + RealizedPnL + UnrealizedPnL - Fees - Funding

PnL% = (EquityVirtual / Stake) - 1

ScoreUSDC = Stake × PnL%

Gana quien tenga mayor ScoreUSDC al final.

3. Terminal (funcionalidades obligatorias)

Se implementan funcionalidades del screenshot:

3.1 Market Header

selector de mercado

last price + 24h %

24h high/low, volume

open interest

funding rate + countdown

settings mínimos (unidad, defaults)

3.2 Chart

OHLC velas + volume

timeframes: 1m/5m/15m/1h/4h/1D/1W

indicadores mínimos: SMA/EMA/RSI

3.3 Orderbook + Depth

bids/asks con size/total

spread

grouping step

toggle unidades USD/token

3.4 Account Panel

connection status

equity, available

unrealized pnl

margin ratio

3.5 Order Entry

Long/Short

Market/Limit

Size + unidad

quick 25/50/75/100

Leverage slider (min/max desde Pacifica por mercado)

breakdown: order value, margin required, est liq, fees

submit buy/sell

3.6 Tabs inferiores

Positions + close/reduce (si aplica)

Open Orders + cancel/cancel all

Trade History (fills)

Funding widget

4. Fight Terminal (competitivo)
   4.1 HUD obligatorio

A vs B (handle + avatar)

timer

PnL% y ScoreUSDC live (A y B)

trades count

leader indicator + lead changed event

fight feed (últimas acciones)

4.2 Realtime

TRADE_EVENT por fill

PNL_TICK cada 1s (o 2s si limitaciones)

FIGHT_FINISHED al cerrar

5. Arquitectura
   5.1 Seguridad

Jamás exponer claves/tokens en frontend.

Todas las órdenes se ejecutan en backend.

Credenciales/tokens en vault/secret manager.

5.2 Componentes

Frontend: Next.js/React + WS client

Backend API: Node (Nest/Fastify) o FastAPI

Realtime:

Pacifica WS consumer (market + user)

Fight Engine (state + scoring)

WS broadcaster propio

DB: Postgres recomendado

Jobs:

leaderboard refresh

cleanup fights stale

reconciliation (fills missing)

6. Datos (DB)

Users

PacificaConnection

Fights

FightParticipants

FightTrades

FightSnapshots (para PnL timeline)

LeaderboardSnapshot (opcional recomendado)

7. API REST (contrato mínimo)

Auth/market/account:

POST /auth/pacifica/connect

GET /markets

GET /account/summary

GET /positions

GET /orders/open

GET /fills?since=...

Orders:

POST /orders

DELETE /orders/:id

DELETE /orders (cancel all)

Fights:

POST /fights (duration, stake)

POST /fights/:id/join

GET /fights (filters)

GET /fights/:id

GET /users/:id/profile

GET /leaderboard?range=weekly|all_time

8. WebSocket (tu servidor)

WS /ws/fights/:fight_id

Eventos:

FIGHT_STATE

FIGHT_STARTED

TRADE_EVENT

PNL_TICK

LEAD_CHANGED

FIGHT_FINISHED

ERROR

9. Observabilidad (Logging + Sentry) — Requisito MVP
   9.1 Principios

Logs estructurados (JSON) en backend (y opcional en frontend).

Cada request y cada evento WS debe tener correlación.

En Sentry:

errors (excepciones)

performance traces (latencia API + WS handlers + jobs)

breadcrumbs con pasos clave del fight y trading

9.2 IDs y correlación (obligatorio)

Campos que deben existir en todos los logs backend:

service (api | realtime | job)

env (dev/staging/prod)

timestamp

level (debug/info/warn/error)

request_id (para HTTP)

trace_id (si usas tracing)

user_id (si autenticado)

fight_id (si aplica)

pacifica_account_id (si aplica, no el secreto)

event (nombre estable del evento)

message (corto, humano)

context (objeto con detalles)

Regla: jamás loguear secretos, tokens, API keys, payloads completos de credenciales.

9.3 Taxonomía de eventos (namespaces)

Nombres consistentes, sin improvisación:

Auth / Pacifica

auth.connect.start

auth.connect.success

auth.connect.failure

pacifica.session.refresh

pacifica.ws.connect

pacifica.ws.disconnect

pacifica.api.rate_limited

Fights

fight.create

fight.join.attempt

fight.join.success

fight.join.rejected

fight.start

fight.tick

fight.finish

fight.cancel.stale

fight.state.rehydrate

Orders / Trading

order.place.request

order.place.accepted

order.place.rejected

order.cancel.request

order.cancel.success

order.cancel.failure

fill.received

position.updated

Scoring

scoring.recalc.start

scoring.recalc.success

scoring.recalc.failure

scoring.snapshot.write

WS Client (tu WS)

ws.client.connect

ws.client.disconnect

ws.event.sent

ws.event.drop (si hay backpressure)

Jobs

job.leaderboard.refresh.start/success/failure

job.reconcile.fills.start/success/failure

9.4 Verificaciones (con logs claros)

Cada punto crítico debe validar y loguear:

Join Fight

Validaciones:

fight existe

status == WAITING

usuario no es creator (o sí, pero no duplicado)

opponent slot libre

user tiene pacifica_connection válida

Logs:

fight.join.attempt (info)

fight.join.rejected (warn) con razón enumerada:

FIGHT_NOT_FOUND

FIGHT_ALREADY_LIVE

FIGHT_FULL

NO_PACIFICA_CONNECTION

Start Fight

Validaciones:

hay 2 participantes

stake/duration válidos

started_at no seteado antes (idempotencia)

Logs:

fight.start (info) + context: {duration, stake}

Place Order

Validaciones:

user conectado

symbol válido

leverage dentro de [min,max] desde Pacifica

size > 0 y dentro de límites

rate limiting interno (evita spam)

Logs:

order.place.request (info) con:

symbol, side, type, size, unit, leverage

order.place.rejected (warn) con reason_code:

INVALID_LEVERAGE

INVALID_SIZE

PACIFICA_ERROR

RATE_LIMITED

order.place.accepted (info) con pacifica_order_id

Fill Received

Validaciones:

fill pertenece al user

timestamp válido

symbol conocido

Logs:

fill.received (info) con:

symbol, qty, price, fee, ts, pacifica_trade_id

Scoring Tick

Validaciones:

fight LIVE

stake > 0

prices disponibles o fallback

no NaN / infinities

Logs:

scoring.recalc.success (debug/info)

En caso de fallos: scoring.recalc.failure (error) con:

missing_price_symbols

exception_type

Finish Fight

Validaciones:

ended_at alcanzado

idempotencia (si llega doble)

persistencia de resultados

Logs:

fight.finish (info) con:

final pnl%, final score, winner_id

9.5 Sentry — Configuración y uso (MVP)
Backend

Sentry SDK en API + realtime service + jobs.

Habilitar performance tracing:

HTTP transactions

WS message handler spans

job spans

Sentry tags recomendados:

service, env

fight_id (si aplica)

user_id (si aplica)

symbol (para orders/fills)

pacifica_region (si aplica)

Sentry breadcrumbs:

fight.start

order.place.request

order.place.accepted/rejected

fill.received

fight.finish

Frontend

Capturar errores de UI y fallos WS.

Marcar páginas:

Lobby

Fight Terminal

Profile/Leaderboard

Breadcrumbs en acciones:

join fight

place order click

WS reconnect attempts

9.6 Niveles de log (regla simple)

info: acciones del usuario + cambios de estado (create/join/start/finish/order accepted)

warn: validaciones fallidas, límites, rechazos esperables

error: excepciones, fallos de integración, inconsistencias de datos

debug: ticks frecuentes, cálculos repetidos, payload reducido (solo en dev/staging)

9.7 Ejemplos de logs (formato final)

Order accepted

{
"level": "info",
"event": "order.place.accepted",
"request_id": "req_8f2",
"user_id": "u_123",
"fight_id": "f_900",
"context": {
"symbol": "SOL-PERP",
"side": "LONG",
"type": "MARKET",
"size": 250,
"unit": "USDC",
"leverage": 10,
"pacifica_order_id": "po_77a"
}
}

Join rejected

{
"level": "warn",
"event": "fight.join.rejected",
"request_id": "req_19c",
"user_id": "u_555",
"fight_id": "f_900",
"context": {
"reason_code": "FIGHT_FULL"
}
}

Scoring failure

{
"level": "error",
"event": "scoring.recalc.failure",
"fight_id": "f_900",
"context": {
"missing_price_symbols": ["BTC-PERP"],
"exception_type": "PriceFeedUnavailable"
}
}

10. Checklist de aceptación (MVP + Observability)

Todos los endpoints críticos loguean request_id, user_id, fight_id cuando aplica.

Todos los cambios de estado del fight generan logs fight.\*.

Todas las órdenes generan order.place.\* y fill.received.

Sentry captura:

errores backend + frontend

performance traces

breadcrumbs de acciones críticas

Existe dashboard interno:

filtros por fight_id, user_id, event

quick view de últimos 500 eventos

11. Leaderboard (MVP)

weekly y all_time

se calculan desde fights FINISHED

draws no suman win/loss

endpoint: GET /leaderboard?range=weekly|all_time

job: job.leaderboard.refresh (cada X min o on-finish)
