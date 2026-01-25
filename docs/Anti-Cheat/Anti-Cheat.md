# Anti-Cheat System - Trade Fight Club

## Filosofia MVP

- No construir un sistema anti-fraude tipo banco
- Bloquear lo obvio, barato y explotable
- 95% de los "cheaters" en early stage son: multi-cuentas basicas, 0 trades, self-match, farming tonto
- No necesitas fingerprinting hardcore ni ML

---

## Reglas Implementadas

| # | Codigo | Regla | Descripcion | Accion |
|---|--------|-------|-------------|--------|
| 1 | ZERO_ZERO | 0-0 No Contest | Ambos PnL ~ $0 o 0 trades | NO_CONTEST |
| 2 | MIN_VOLUME | Volumen Minimo | Notional < $10 por jugador | NO_CONTEST |
| 3 | TFC_ONLY | Solo Trades TFC | Solo trades con fightId | Ya implementado |
| 4 | REPEATED_MATCHUP | Limite Matchups | A vs B >= 3 en 24h | NO_CONTEST + bloqueo |
| 5 | SAME_IP | Patron IP | Misma IP + repetido | NO_CONTEST (2+ ofensas) |

---

## Detalle de Reglas

### Regla 1: ZERO_ZERO (0-0 = NO CONTEST)

**Condicion:**
- PnL A ~ 0 AND PnL B ~ 0 (umbral: $0.01)
- O ambos tienen 0 trades

**Consecuencia:**
- `status = NO_CONTEST`
- No cuenta para ranking
- No cuenta para winrate
- No cuenta para PnL

**Mata:** 80% del farming

---

### Regla 2: MIN_VOLUME (Volumen Minimo Real)

**Condicion:**
- `MIN_NOTIONAL_PER_PLAYER = $10`
- Si total notional de cualquier jugador < minimo

**Consecuencia:**
- Fight excluido (NO_CONTEST)

**Mata:** micro-trades fake ("abro $0.10 y cierro")

---

### Regla 3: TFC_ONLY (Solo Trades TFC)

**Ya implementado:**
- Requiere fightId en cada trade
- Todo desde tabla FightTrade
- Trades externos de Pacifica ignorados

**Mata:** manipulacion fuera de app

---

### Regla 4: REPEATED_MATCHUP (Limite Enfrentamientos Repetidos)

**Condicion:**
- A vs B >= 3 veces en ultimas 24h

**Consecuencia:**
- Fight marcado como NO_CONTEST
- Matchmaking bloquea ese par (pre-join check)

**Mata:** multi-cuenta basica

**Implementacion:**
```sql
count fights where (A,B) last 24h
```

---

### Regla 5: SAME_IP (Patron IP Sospechoso)

**Datos guardados:**
- IP address
- User Agent

**Condicion:**
- Misma IP + enfrentamiento repetido + patron 0-0
- Umbral: 2+ fights sospechosos desde misma IP

**Consecuencia:**
- Primera ofensa: flag para review (no ban)
- Segunda ofensa: fight excluido automaticamente

**Mata:** self-match obvio

---

## Arquitectura Tecnica

### Nuevo Status: NO_CONTEST

```prisma
enum FightStatus {
  WAITING
  LIVE
  FINISHED
  CANCELLED
  NO_CONTEST  // Excluido de ranking
}
```

### Nueva Tabla: FightSession

```prisma
model FightSession {
  id          String   @id @default(uuid())
  fightId     String   @map("fight_id")
  userId      String   @map("user_id")
  ipAddress   String   @map("ip_address")
  userAgent   String?  @map("user_agent")
  sessionType String   @map("session_type") // 'join' | 'trade'
  createdAt   DateTime @default(now())

  fight Fight @relation(...)

  @@index([fightId])
  @@index([userId])
  @@index([ipAddress])
  @@map("fight_sessions")
}
```

### Nueva Tabla: AntiCheatViolation

```prisma
model AntiCheatViolation {
  id          String   @id @default(uuid())
  fightId     String   @map("fight_id")
  ruleCode    String   @map("rule_code")
  ruleName    String   @map("rule_name")
  ruleMessage String   @map("rule_message")
  metadata    Json?
  actionTaken String   @map("action_taken") // NO_CONTEST | FLAGGED
  createdAt   DateTime @default(now())

  fight Fight @relation(...)

  @@index([fightId])
  @@index([ruleCode])
  @@map("anti_cheat_violations")
}
```

---

## Servicio Centralizado

**Archivo:** `apps/web/src/lib/server/anti-cheat.ts`

### Constantes Configurables

```typescript
export const ANTI_CHEAT_CONSTANTS = {
  ZERO_PNL_THRESHOLD_USDC: 0.01,    // Umbral para "cero"
  MIN_NOTIONAL_PER_PLAYER: 10,      // $10 minimo volumen
  MAX_MATCHUPS_PER_24H: 3,          // Maximo matchups repetidos
  MATCHUP_WINDOW_HOURS: 24,         // Ventana de tiempo
  IP_SAME_PAIR_THRESHOLD: 2,        // Fights misma IP antes de excluir
};
```

### Funciones Principales

| Funcion | Proposito |
|---------|-----------|
| `extractIpAddress(request)` | Extrae IP de headers |
| `validateZeroZeroRule(data)` | Valida regla 0-0 |
| `validateMinVolumeRule(data)` | Valida volumen minimo |
| `validateRepeatedMatchupRule(data)` | Valida matchups repetidos |
| `validateSameIpPattern(data)` | Valida patron IP |
| `validateFightForSettlement(fightId)` | Ejecuta todas las reglas |
| `canUsersMatch(userAId, userBId)` | Pre-matchmaking check |
| `recordFightSession(...)` | Guarda IP/UA |
| `settleFightWithAntiCheat(...)` | Settlement con validacion |

---

## Flujos

### Settlement Flow

```
Fight termina (tiempo = 0)
    |
fight-engine.ts -> POST /api/internal/anti-cheat/settle
    |
anti-cheat.ts ejecuta reglas:
  1. validateZeroZeroRule()
  2. validateMinVolumeRule()
  3. validateRepeatedMatchupRule()
  4. validateSameIpPattern()
    |
Violaciones excluyentes?
  SI -> status = NO_CONTEST, winnerId = null, log violation
  NO -> status = FINISHED, winnerId = ganador
    |
fight-engine.ts actualiza DB
    |
Emite FIGHT_FINISHED
```

### Matchmaking Flow

```
Usuario B quiere unirse
    |
canUsersMatch(userAId, userBId)
    |
count = fights entre A,B en 24h
    |
count >= 3?
  SI -> Rechazar join con error
  NO -> Permitir, recordFightSession()
```

---

## Archivos a Modificar

| Archivo | Accion | Prioridad |
|---------|--------|-----------|
| `packages/db/prisma/schema.prisma` | Modificar | 1 |
| `apps/web/src/lib/server/anti-cheat.ts` | Crear | 2 |
| `apps/web/src/app/api/internal/anti-cheat/settle/route.ts` | Crear | 3 |
| `apps/realtime/src/fight-engine.ts` | Modificar | 4 |
| `apps/web/src/app/api/fights/route.ts` | Modificar | 5 |
| `apps/web/src/app/api/fights/[id]/join/route.ts` | Modificar | 6 |
| `apps/web/src/app/api/leaderboard/route.ts` | Modificar | 7 |

**Total: 7 archivos** (2 crear, 5 modificar)

---

## Verificacion

1. `npx prisma migrate dev --name add-anti-cheat`
2. Test Zero-Zero: ambos no tradean -> NO_CONTEST
3. Test Min Volume: tradear < $10 -> NO_CONTEST
4. Test Repeated Matchup: 3 fights en 24h -> join bloqueado
5. Test Same IP: misma IP -> flag en violations
6. Test Leaderboard: NO_CONTEST no aparece en stats

---

## Gestion (Prisma Studio)

```bash
npx prisma studio
```

### Ver Violaciones
1. Abrir tabla `anti_cheat_violations`
2. Filtrar por `ruleCode` para ver patrones

### Ver Sesiones IP
1. Abrir tabla `fight_sessions`
2. Agrupar por `ipAddress` para detectar multi-cuenta

---

## Extensibilidad

Para agregar nueva regla:

1. Agregar nuevo `AntiCheatRuleCode` al type
2. Crear funcion `validateXxxRule(data)`
3. Agregar al array en `validateFightForSettlement()`
4. Decidir si excluye o solo flag

Ejemplo:
```typescript
async function validateWashTradingRule(data: FightDataForValidation): Promise<ValidationResult> {
  // Detectar patrones de wash trading
}
```

---

## IMPLEMENTACION - PASOS DETALLADOS

> **NOTA:** Marcar con [x] cada paso completado para tracking de progreso.

### PASO 1: Schema de Base de Datos
**Archivo:** `packages/db/prisma/schema.prisma`
**Estado:** [x] COMPLETADO

1.1. [x] Agregar `NO_CONTEST` al enum `FightStatus`:
```prisma
enum FightStatus {
  WAITING
  LIVE
  FINISHED
  CANCELLED
  NO_CONTEST  // NUEVO
}
```

1.2. [x] Agregar modelo `FightSession` (despues de FightSnapshot):
```prisma
model FightSession {
  id          String   @id @default(uuid())
  fightId     String   @map("fight_id")
  fight       Fight    @relation(fields: [fightId], references: [id], onDelete: Cascade)
  userId      String   @map("user_id")
  ipAddress   String   @map("ip_address")
  userAgent   String?  @map("user_agent")
  sessionType String   @map("session_type")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([fightId])
  @@index([userId])
  @@index([ipAddress])
  @@map("fight_sessions")
}
```

1.3. [x] Agregar modelo `AntiCheatViolation`:
```prisma
model AntiCheatViolation {
  id          String   @id @default(uuid())
  fightId     String   @map("fight_id")
  fight       Fight    @relation(fields: [fightId], references: [id], onDelete: Cascade)
  ruleCode    String   @map("rule_code")
  ruleName    String   @map("rule_name")
  ruleMessage String   @map("rule_message")
  metadata    Json?
  actionTaken String   @map("action_taken")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([fightId])
  @@index([ruleCode])
  @@index([createdAt])
  @@map("anti_cheat_violations")
}
```

1.4. [x] Agregar relaciones a modelo `Fight`:
```prisma
  sessions   FightSession[]
  violations AntiCheatViolation[]
```

---

### PASO 2: Servicio Anti-Cheat Centralizado
**Archivo:** `apps/web/src/lib/server/anti-cheat.ts`
**Estado:** [x] COMPLETADO

2.1. [x] Crear archivo con imports y constantes
2.2. [x] Implementar tipos: AntiCheatRuleCode, ValidationResult, FightValidationResult
2.3. [x] Implementar extractIpAddress(request)
2.4. [x] Implementar extractUserAgent(request)
2.5. [x] Implementar calculateParticipantNotional(trades, userId)
2.6. [x] Implementar validateZeroZeroRule(data)
2.7. [x] Implementar validateMinVolumeRule(data)
2.8. [x] Implementar validateRepeatedMatchupRule(data)
2.9. [x] Implementar validateSameIpPattern(data)
2.10. [x] Implementar validateFightForSettlement(fightId)
2.11. [x] Implementar canUsersMatch(userAId, userBId)
2.12. [x] Implementar recordFightSession(fightId, userId, request, sessionType)
2.13. [x] Implementar logViolation(fightId, violation, actionTaken)
2.14. [x] Implementar settleFightWithAntiCheat(fightId, winnerId, isDraw)

---

### PASO 3: API Endpoint Settlement Interno
**Archivo:** `apps/web/src/app/api/internal/anti-cheat/settle/route.ts`
**Estado:** [x] COMPLETADO

3.1. [x] Crear directorio `apps/web/src/app/api/internal/anti-cheat/`
3.2. [x] Crear archivo settle/route.ts
3.3. [x] Implementar POST handler con validacion de key interna
3.4. [x] Llamar a settleFightWithAntiCheat()
3.5. [x] Retornar resultado con finalStatus, winnerId, isDraw, violations

---

### PASO 4: Integrar en Fight Engine
**Archivo:** `apps/realtime/src/fight-engine.ts`
**Estado:** [x] COMPLETADO

4.1. [x] Agregar variable de entorno WEB_API_URL
4.2. [x] Agregar variable de entorno INTERNAL_API_KEY
4.3. [x] En endFight(), antes de actualizar DB:
  - Llamar POST /api/internal/anti-cheat/settle
  - Usar resultado para determinar status final
4.4. [x] Usar settlementResult.finalStatus en lugar de hardcoded FINISHED
4.5. [x] Si NO_CONTEST, setear winnerId = null
4.6. [x] Emitir FIGHT_FINISHED con status correcto

---

### PASO 5: Record Session en Fight Creation
**Archivo:** `apps/web/src/app/api/fights/route.ts`
**Estado:** [x] COMPLETADO

5.1. [x] Importar recordFightSession de anti-cheat
5.2. [x] Despues de crear fight, llamar:
```typescript
await recordFightSession(fight.id, user.userId, request, 'join');
```

---

### PASO 6: Validar y Record en Fight Join
**Archivo:** `apps/web/src/app/api/fights/[id]/join/route.ts`
**Estado:** [x] COMPLETADO

6.1. [x] Importar canUsersMatch y recordFightSession
6.2. [x] Antes de permitir join, validar:
```typescript
const matchCheck = await canUsersMatch(fight.creatorId, user.userId);
if (!matchCheck.canMatch) {
  throw new BadRequestError(matchCheck.reason);
}
```
6.3. [x] Despues de join exitoso:
```typescript
await recordFightSession(params.id, user.userId, request, 'join');
```

---

### PASO 7: Excluir NO_CONTEST del Leaderboard
**Archivo:** `apps/web/src/app/api/leaderboard/route.ts`
**Estado:** [x] COMPLETADO (ya existia)

7.1. [x] Buscar queries de FightParticipant
7.2. [x] El filtro `fight: { status: 'FINISHED' }` ya existe - excluye NO_CONTEST automaticamente
7.3. [x] Stats solo incluyen FINISHED en todos los archivos:
   - `apps/web/src/app/api/leaderboard/route.ts`
   - `apps/jobs/src/jobs/leaderboard-refresh.ts`
   - `apps/api/src/modules/leaderboard/leaderboard.service.ts`

---

### PASO 8: Migracion de Base de Datos
**Estado:** [x] COMPLETADO

8.1. [x] Ejecutar: `cd packages/db && npx prisma db push` (usado en vez de migrate por drift)
8.2. [x] Verificar que schema se aplique correctamente
8.3. [x] Cliente Prisma regenerado automaticamente

---

### PASO 9: Verificacion Final
**Estado:** [x] COMPLETADO

9.1. [x] Compilar proyecto: TypeScript compila sin errores
9.2. [x] Verificar sin errores TypeScript: apps/web y apps/realtime OK
9.3. [x] Test automatizado: Script `apps/web/src/scripts/test-anti-cheat.ts` - 7/7 tests pasados
9.4. [x] Test Leaderboard: Verificado que NO_CONTEST excluye correctamente

**Tests ejecutados:**
```
1. ✅ ZERO_ZERO Rule - PnL < $0.01 detectado
2. ✅ MIN_VOLUME Rule - Volumen < $10 detectado
3. ✅ REPEATED_MATCHUP Rule - 3+ fights en 24h detectado
4. ✅ SAME_IP_PATTERN Rule - Misma IP detectada
5. ✅ Violation Logging - Guardado en DB correcto
6. ✅ NO_CONTEST Status - Status y winnerId=null correcto
7. ✅ Leaderboard Exclusion - NO_CONTEST excluido de stats
```

---

## PROGRESO ACTUAL

**Implementacion completada:** Sistema anti-cheat 100% funcional
**Script de test:** `npx tsx apps/web/src/scripts/test-anti-cheat.ts`
