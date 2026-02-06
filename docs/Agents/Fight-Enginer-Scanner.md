# Fight Engine Scanner Agent

> Agente de escaneo A-Z del Fight System para detectar errores, inconsistencias y problemas de concurrencia.

## Problema Reportado

**El sistema de anticheat funciona correctamente, pero el estado del fight en la base de datos está siendo sobrescrito por otro servicio**, causando inconsistencias en los resultados finales.

---

## RESUMEN EJECUTIVO DE PROBLEMAS DETECTADOS

| # | Severidad | Problema | Ubicación | Impacto |
|---|-----------|----------|-----------|---------|
| 1 | **CRÍTICO** | Race condition entre FightEngine y reconcile-fights | `fight-engine.ts:946` + `reconcile-fights.ts:57` | Estado sobrescrito |
| 2 | **CRÍTICO** | Múltiples servicios escriben el mismo estado | 4 servicios diferentes | Inconsistencia de datos |
| 3 | **ALTO** | No hay distributed lock para settlement | `endFight()` y `finalizeFight()` | Procesamiento duplicado |
| 4 | **ALTO** | Actualización de participantes sin transacción | `fight-engine.ts:1022-1040` | Estado parcial |
| 5 | **MEDIO** | Campo `endedAt` sobrescrito con valor diferente | `fights.service.ts:257` vs `fight-engine.ts:1175` | Timestamps incorrectos |
| 6 | **MEDIO** | Anti-cheat puede dar resultados diferentes en tiempo | `anti-cheat.ts:545` | Resultados inconsistentes |

---

## ANÁLISIS DETALLADO

### 1. RACE CONDITION PRINCIPAL (CRÍTICO)

#### Descripción
Dos servicios independientes intentan finalizar el mismo fight casi simultáneamente:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIMELINE DE RACE CONDITION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  t=0        FightEngine detecta timeRemainingMs <= 0                        │
│  t=1ms      FightEngine llama endFight()                                    │
│  t=2ms      FightEngine agrega a settlingFights                             │
│  t=5ms      FightEngine calcula estado final                                │
│  t=10ms     FightEngine actualiza FightParticipants                         │
│  t=15ms     FightEngine llama anti-cheat API (HTTP)                         │
│  t=20ms     ─────────── MIENTRAS TANTO ───────────                          │
│  t=20ms     reconcile-fights JOB SE EJECUTA                                 │
│  t=21ms     Job encuentra fight LIVE que debió terminar hace 30s            │
│  t=22ms     Job calcula scores (puede ser diferente)                        │
│  t=25ms     Job llama anti-cheat API                                        │
│  t=30ms     Job hace updateMany WHERE status=LIVE                           │
│  t=31ms     Job ACTUALIZA EL FIGHT (status=FINISHED, winnerId=X)            │
│  t=50ms     FightEngine recibe respuesta de anti-cheat                      │
│  t=51ms     FightEngine hace updateMany WHERE status=LIVE                   │
│  t=52ms     updateMany.count = 0 (ya fue actualizado!)                      │
│  t=53ms     FightEngine emite FIGHT_FINISHED con datos DIFERENTES           │
│                                                                              │
│  RESULTADO: WebSocket dice winnerId=Y, pero DB tiene winnerId=X             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Archivos Involucrados

| Archivo | Línea | Función | Problema |
|---------|-------|---------|----------|
| [fight-engine.ts:946-1243](../apps/realtime/src/fight-engine.ts#L946-L1243) | 946 | `endFight()` | Proceso principal de settlement |
| [reconcile-fights.ts:57-87](../apps/jobs/src/jobs/reconcile-fights.ts#L57-L87) | 57 | `reconcileFights()` | Job que también hace settlement |
| [reconcile-fights.ts:89-200](../apps/jobs/src/jobs/reconcile-fights.ts#L89-L200) | 89 | `finalizeFight()` | Duplica la lógica de endFight |

#### Código Problemático

**fight-engine.ts:1168-1179** - FightEngine update:
```typescript
const updateResult = await prisma.fight.updateMany({
  where: {
    id: fightId,
    status: FightStatus.LIVE, // Solo actualiza si aún está LIVE
  },
  data: {
    status: finalStatus === 'NO_CONTEST' ? FightStatus.NO_CONTEST : FightStatus.FINISHED,
    endedAt: new Date(),
    winnerId,
    isDraw,
  },
});
```

**reconcile-fights.ts:156-169** - Job update:
```typescript
const updateResult = await prisma.fight.updateMany({
  where: {
    id: fightId,
    status: FightStatus.LIVE, // MISMO CHECK
  },
  data: {
    status: antiCheatResult.finalStatus === 'NO_CONTEST'
      ? FightStatus.NO_CONTEST
      : FightStatus.FINISHED,
    endedAt: new Date(),
    winnerId: antiCheatResult.winnerId,
    isDraw: antiCheatResult.isDraw,
  },
});
```

**El problema:** Ambos usan `WHERE status = LIVE`, pero hay una ventana de tiempo entre la verificación y la escritura donde ambos pueden pasar la condición.

---

### 2. MÚLTIPLES SERVICIOS ESCRIBEN EL MISMO ESTADO (CRÍTICO)

#### Servicios que modifican `fights` table:

| Servicio | Puerto | Archivo | Operación |
|----------|--------|---------|-----------|
| API | 3001 | [fights.service.ts](../apps/api/src/modules/fights/fights.service.ts) | CREATE, UPDATE (join), DELETE (cancel) |
| Realtime | 3002 | [fight-engine.ts](../apps/realtime/src/fight-engine.ts) | UPDATE (settlement) |
| Jobs | N/A | [reconcile-fights.ts](../apps/jobs/src/jobs/reconcile-fights.ts) | UPDATE (settlement) |
| Jobs | N/A | [cleanup-stale-fights.ts](../apps/jobs/src/jobs/cleanup-stale-fights.ts) | UPDATE (WAITING → CANCELLED) |

#### Diagrama de Conflictos:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICIOS → DB (fights)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   API Service (3001)                                             │
│   └── joinFight() ───────────────┐                               │
│       • status: WAITING → LIVE   │                               │
│       • startedAt: now           │                               │
│       • endedAt: now + duration  ├──→ WRITES TO DB               │
│                                  │                               │
│   Realtime Service (3002)        │                               │
│   └── endFight() ────────────────┤                               │
│       • status: LIVE → FINISHED  │                               │
│       • endedAt: now (overwrites!)                               │
│       • winnerId                 │                               │
│       • isDraw                   ├──→ WRITES TO DB               │
│                                  │                               │
│   Jobs Service                   │                               │
│   └── reconcileFights() ─────────┤                               │
│       • status: LIVE → FINISHED  │                               │
│       • PUEDE USAR DATOS         │                               │
│         DIFERENTES               ├──→ WRITES TO DB               │
│                                  │                               │
│   └── cleanupStaleFights() ──────┤                               │
│       • status: WAITING →        │                               │
│         CANCELLED                ├──→ WRITES TO DB               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. NO HAY DISTRIBUTED LOCK (ALTO)

#### Problema
El `settlingFights` Set en FightEngine es un lock **local en memoria** que solo funciona dentro del proceso de realtime:

```typescript
// fight-engine.ts:437
private settlingFights: Set<string> = new Set();
```

**Este lock NO protege contra:**
- El job `reconcile-fights` corriendo en otro proceso
- Múltiples instancias del realtime service (si hay horizontal scaling)
- Reinicio del servicio (se pierde el Set)

#### Solución Necesaria
Implementar un distributed lock usando:
- Redis SETNX con TTL
- PostgreSQL advisory locks
- Campo `settling_started_at` en la tabla fights

---

### 4. ACTUALIZACIÓN SIN TRANSACCIÓN ATÓMICA (ALTO)

#### Código Problemático

**fight-engine.ts:1021-1041**:
```typescript
// PRIMERO: Actualiza participantes
if (finalState.participantA) {
  await prisma.fightParticipant.updateMany({
    where: { fightId, userId: finalState.participantA.userId },
    data: {
      finalPnlPercent: finalState.participantA.pnlPercent,
      finalScoreUsdc: finalState.participantA.scoreUsdc,
      tradesCount: finalState.participantA.tradesCount,
    },
  });
}
// ...participantB igual...

// DESPUÉS: Actualiza fight (sin transacción!)
const updateResult = await prisma.fight.updateMany({
  where: { id: fightId, status: FightStatus.LIVE },
  data: { status: finalStatus, ... },
});
```

**Problema:** Si el proceso muere entre actualizar participantes y actualizar el fight:
- Los participantes tienen scores finales
- El fight sigue en estado LIVE
- Los datos quedan inconsistentes

---

### 5. CAMPO `endedAt` SOBRESCRITO (MEDIO)

#### Flujo del Problema:

1. **Usuario B se une al fight** (`fights.service.ts:257`):
   ```typescript
   const endedAt = new Date(now.getTime() + fight.durationMinutes * 60 * 1000);
   // endedAt = 2024-01-15T10:05:00.000Z (predicción de cuándo termina)
   ```

2. **Fight termina** (`fight-engine.ts:1175`):
   ```typescript
   data: {
     endedAt: new Date(), // SOBRESCRIBE con timestamp real
     // endedAt = 2024-01-15T10:05:02.341Z (momento real)
   }
   ```

**Impacto:** El `endedAt` pierde el valor "predicho" y se reemplaza con el valor real. Esto puede causar confusión en auditorías si alguien espera que `endedAt` sea `startedAt + duration`.

---

### 6. ANTI-CHEAT PUEDE DAR RESULTADOS DIFERENTES (MEDIO)

#### Escenario:

```
t=0    FightEngine llama validateFightForSettlement()
       → trades = 50
       → matchupCount = 2
       → Result: FINISHED, winnerId=Alice

t=5s   reconcile-fights llama validateFightForSettlement()
       → trades = 50 (mismo)
       → matchupCount = 3 (CAMBIÓ! otro fight terminó)
       → Result: NO_CONTEST (REPEATED_MATCHUP violation)
```

**Problema:** Las validaciones basadas en tiempo/conteo pueden dar diferentes resultados dependiendo de cuándo se ejecutan.

---

## MAPA DE ARCHIVOS CRÍTICOS

### Escritura del Estado del Fight

```
📁 apps/
├── 📁 api/src/modules/fights/
│   └── 📄 fights.service.ts
│       ├── createFight()     → CREATE fight (status=WAITING)
│       ├── joinFight()       → UPDATE fight (status=LIVE, startedAt, endedAt)
│       └── cancelFight()     → DELETE fight
│
├── 📁 realtime/src/
│   └── 📄 fight-engine.ts
│       ├── endFight()        → UPDATE fight (status=FINISHED, winnerId, etc.)
│       └── saveSnapshot()    → CREATE fight_snapshots
│
├── 📁 jobs/src/jobs/
│   ├── 📄 reconcile-fights.ts
│   │   └── finalizeFight()   → UPDATE fight (DUPLICA endFight!)
│   └── 📄 cleanup-stale-fights.ts
│       └── cleanupStaleFights() → UPDATE fight (status=CANCELLED)
│
└── 📁 web/src/lib/server/
    └── 📄 anti-cheat.ts
        └── logViolation()    → CREATE anti_cheat_violations
```

### Lectura del Estado (para cálculos)

```
📁 apps/
├── 📁 realtime/src/
│   └── 📄 fight-engine.ts
│       ├── calculateFightState()  → READ fight, fight_trades
│       └── processTick()          → READ fights WHERE status=LIVE
│
├── 📁 jobs/src/jobs/
│   └── 📄 reconcile-fights.ts
│       └── reconcileFights()      → READ fights WHERE status=LIVE
│
└── 📁 web/src/lib/server/
    └── 📄 anti-cheat.ts
        └── validateFightForSettlement() → READ fight, participants, trades, sessions
```

---

## INSTRUCCIONES PARA EL AGENTE DE ESCANEO

### Comandos de Escaneo

```bash
# 1. Buscar fights en estado inconsistente
SELECT f.id, f.status, f.winner_id,
       pa.final_pnl_percent as pnl_a,
       pb.final_pnl_percent as pnl_b
FROM fights f
JOIN fight_participants pa ON f.id = pa.fight_id AND pa.slot = 'A'
JOIN fight_participants pb ON f.id = pb.fight_id AND pb.slot = 'B'
WHERE f.status = 'FINISHED'
  AND f.winner_id IS NOT NULL
  AND (
    -- Winner tiene menor PnL que el perdedor
    (f.winner_id = pa.user_id AND pa.final_pnl_percent < pb.final_pnl_percent)
    OR
    (f.winner_id = pb.user_id AND pb.final_pnl_percent < pa.final_pnl_percent)
  );

# 2. Buscar fights que deberían ser NO_CONTEST pero son FINISHED
SELECT f.id, acv.rule_code, acv.action_taken, f.status
FROM fights f
JOIN anti_cheat_violations acv ON f.id = acv.fight_id
WHERE acv.action_taken = 'NO_CONTEST'
  AND f.status = 'FINISHED';  -- DEBERÍA SER NO_CONTEST!

# 3. Buscar discrepancias en endedAt
SELECT id,
       started_at,
       ended_at,
       duration_minutes,
       started_at + (duration_minutes * interval '1 minute') as expected_end,
       ended_at - (started_at + (duration_minutes * interval '1 minute')) as drift
FROM fights
WHERE status IN ('FINISHED', 'NO_CONTEST')
  AND ABS(EXTRACT(EPOCH FROM (ended_at - (started_at + (duration_minutes * interval '1 minute'))))) > 5;

# 4. Buscar participantes con scores pero fight aún LIVE
SELECT f.id, f.status, fp.user_id, fp.final_pnl_percent, fp.final_score_usdc
FROM fights f
JOIN fight_participants fp ON f.id = fp.fight_id
WHERE f.status = 'LIVE'
  AND (fp.final_pnl_percent IS NOT NULL OR fp.final_score_usdc IS NOT NULL);
```

### Checklist de Escaneo

- [ ] **Fights en estado inconsistente**
  - [ ] Status=FINISHED pero winner tiene menor PnL
  - [ ] Status=FINISHED pero anti-cheat dice NO_CONTEST
  - [ ] Status=LIVE pero ya pasó `startedAt + duration + 2 minutos`

- [ ] **Participants con datos parciales**
  - [ ] Tiene `finalScoreUsdc` pero fight no está terminado
  - [ ] No tiene `finalScoreUsdc` pero fight está terminado
  - [ ] `tradesCount` no coincide con COUNT de fight_trades

- [ ] **Anti-cheat violations huérfanas**
  - [ ] Violation con `action_taken=NO_CONTEST` pero fight es FINISHED
  - [ ] Fight tiene violations pero no hay registro de qué pasó

- [ ] **Snapshots inconsistentes**
  - [ ] Snapshots después de `endedAt`
  - [ ] Gaps grandes en timeline de snapshots

- [ ] **Race conditions detectables**
  - [ ] Múltiples violations para el mismo fight en < 1 segundo
  - [ ] Logs de "Fight already settled" en realtime
  - [ ] Logs de reconcile-fights actualizando fights

---

## SOLUCIONES RECOMENDADAS

### Solución 1: Distributed Lock con Redis

```typescript
// fight-engine.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const LOCK_TTL_MS = 30000; // 30 segundos

async function acquireSettlementLock(fightId: string): Promise<boolean> {
  const key = `fight:settlement:${fightId}`;
  const result = await redis.set(key, 'locked', 'PX', LOCK_TTL_MS, 'NX');
  return result === 'OK';
}

async function releaseSettlementLock(fightId: string): Promise<void> {
  await redis.del(`fight:settlement:${fightId}`);
}

// En endFight():
private async endFight(fightId: string, state: FightState) {
  const acquired = await acquireSettlementLock(fightId);
  if (!acquired) {
    logger.warn('Settlement lock not acquired, skipping', { fightId });
    return;
  }

  try {
    // ... settlement logic ...
  } finally {
    await releaseSettlementLock(fightId);
  }
}
```

### Solución 2: Campo `settling_at` en DB

```sql
ALTER TABLE fights ADD COLUMN settling_at TIMESTAMP;
ALTER TABLE fights ADD COLUMN settling_by VARCHAR(50); -- 'realtime' | 'reconcile-job'
```

```typescript
// Antes de hacer settlement:
const lockResult = await prisma.fight.updateMany({
  where: {
    id: fightId,
    status: FightStatus.LIVE,
    settlingAt: null, // Solo si nadie está settling
  },
  data: {
    settlingAt: new Date(),
    settlingBy: 'realtime',
  },
});

if (lockResult.count === 0) {
  // Otro proceso ya está settling
  return;
}
```

### Solución 3: Transacción Atómica para Settlement

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Actualizar participantes
  await tx.fightParticipant.updateMany({...});
  await tx.fightParticipant.updateMany({...});

  // 2. Actualizar fight
  await tx.fight.updateMany({
    where: { id: fightId, status: FightStatus.LIVE },
    data: { status: finalStatus, winnerId, isDraw, endedAt: new Date() },
  });

  // 3. Log violations (si aplica)
  if (violations.length > 0) {
    await tx.antiCheatViolation.createMany({...});
  }
});
```

### Solución 4: Desactivar reconcile-fights para fights recientes

```typescript
// reconcile-fights.ts
export async function reconcileFights(): Promise<void> {
  const now = Date.now();
  const BUFFER_MS = 60000; // 1 minuto de buffer

  const liveFights = await prisma.fight.findMany({
    where: {
      status: FightStatus.LIVE,
      startedAt: { not: null },
    },
  });

  for (const fight of liveFights) {
    const endTime = fight.startedAt!.getTime() + fight.durationMinutes * 60 * 1000;

    // Solo reconciliar si pasó más de 1 MINUTO después del tiempo esperado
    // Esto da tiempo al realtime service para hacer su trabajo
    if (now > endTime + BUFFER_MS) {
      await finalizeFight(...);
    }
  }
}
```

---

## MONITOREO Y ALERTAS

### Métricas a Implementar

```typescript
// Prometheus metrics
const fightSettlementConflicts = new Counter({
  name: 'fight_settlement_conflicts_total',
  help: 'Number of times settlement was skipped due to conflict',
  labelNames: ['service'], // 'realtime' | 'reconcile-job'
});

const fightSettlementDuration = new Histogram({
  name: 'fight_settlement_duration_seconds',
  help: 'Time taken to settle a fight',
  labelNames: ['service', 'status'], // status: 'FINISHED' | 'NO_CONTEST'
});

const fightStateInconsistencies = new Gauge({
  name: 'fight_state_inconsistencies',
  help: 'Number of fights in inconsistent state',
});
```

### Queries para Dashboard

```sql
-- Fights settled por servicio (últimas 24h)
SELECT
  CASE
    WHEN settling_by = 'realtime' THEN 'Realtime Engine'
    WHEN settling_by = 'reconcile-job' THEN 'Reconcile Job'
    ELSE 'Unknown'
  END as service,
  COUNT(*) as count
FROM fights
WHERE ended_at > NOW() - INTERVAL '24 hours'
GROUP BY settling_by;

-- Conflictos de settlement (fights que aparecen en logs de ambos)
-- Requiere parsing de logs
```

---

## CONCLUSIÓN

El problema principal es que **hay múltiples servicios que pueden escribir el estado final del fight sin coordinación adecuada**. El `settlingFights` Set solo funciona dentro del proceso de realtime, pero el job de reconciliación corre en un proceso separado.

**Prioridad de implementación:**
1. **INMEDIATO:** Implementar distributed lock (Redis o DB)
2. **CORTO PLAZO:** Migrar settlement a transacción atómica
3. **MEDIO PLAZO:** Añadir métricas y alertas
4. **LARGO PLAZO:** Considerar event sourcing para estado del fight

---

*Generado por Fight Engine Scanner Agent v1.0*
*Fecha: 2026-02-03*
