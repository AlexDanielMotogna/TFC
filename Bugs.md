# Bugs Pendientes

## 1. Fight Trades registra trades que no se ejecutaron

**Fecha:** 2026-01-14
**Fight ID:** `421fa46a-db94-4478-a5b2-540fbe9514d1`
**Usuario afectado:** `1a867a43-70ca-40d3-867c-5370c98c8d50`

### Descripcion

Cuando un usuario intenta hacer un trade opuesto a su posicion actual (ej: tiene LONG e intenta SHORT), aparece el modal de "Flip Position". Si el usuario **cancela** el modal (no confirma), el trade de todas formas se registra en la tabla `fight_trades`.

### Evidencia

**Tabla `fight_trades` (incorrecto - 3 registros):**
| id | fight_id | user_id | pacifica_trade_id | fill_id | symbol | side | amount | price | timestamp |
|----|----------|---------|-------------------|---------|--------|------|--------|-------|-----------|
| e2427481... | 421fa46a... | 1a867a43... | 105440231 | 2813845110 | BTC | SELL | 0.00021 | 96287 | 18:39:57 |
| 70b330b3... | 421fa46a... | 1a867a43... | 105440725 | 2813890017 | BTC | SELL | 0.00001 | 96335 | 18:40:44 |
| 4c664470... | 421fa46a... | 1a867a43... | 105444560 | 2814150098 | BTC | SELL | 0.00116 | 96282 | 18:46:04 |

**Tabla `trades` con fight_id (correcto - 1 registro):**
| id | user_id | pacifica_trade_id | symbol | side | amount | price | fight_id |
|----|---------|-------------------|--------|------|--------|-------|----------|
| 5460ca7b... | 1a867a43... | 105444560 | BTC | SELL | 0.00116 | 96282 | 421fa46a... |

### Comportamiento esperado

Solo el trade de 0.00116 BTC deberia aparecer en `fight_trades` ya que fue el unico que realmente se ejecuto durante el fight.

### Comportamiento actual

Los 3 trades aparecen en `fight_trades`, incluyendo 2 que el usuario cancelo o que no se completaron correctamente.

### Posibles causas

1. El sistema registra trades en `fight_trades` antes de confirmar que realmente se ejecutaron
2. Los trades cancelados en el frontend igual llegan al backend y se registran
3. El WebSocket de Pacifica esta reportando trades que no deberia

### Archivos a investigar

- `apps/backend/src/modules/fights/` - Logica de registro de fight trades
- `apps/backend/src/modules/trades/` - Procesamiento de trades de Pacifica
- Buscar donde se hace `INSERT INTO fight_trades`

### Estado

🔴 Pendiente

---

## 2. Cierre de posiciones pre-fight cuenta como trade del fight

**Fecha:** 2026-01-16
**Fight ID:** `19407dd3-eb47-4b5e-a835-7cb0fa7ac7b3`
**Usuario afectado:** `cdd426cf-8264-4823-9912-689dfc5cbe4d` (Slot A)

### Descripcion

Cuando un usuario tiene una posicion abierta ANTES de unirse a un fight, y cierra esa posicion DURANTE el fight, el trade de cierre se registra incorrectamente como `fight_trade` y afecta el calculo de PnL del fight.

### Evidencia

**Tabla `fight_participants`:**
| user_id | slot | joined_at | positions_at_start | initial_margin |
|---------|------|-----------|-------------------|----------------|
| cdd426cf... | A | 19:29:33 | `{}` (vacio) | 35.14 |
| b7f48d15... | B | 19:36:40 | `[{"amount": "0.00048", "symbol": "BTC"...}]` | 45.72 |

**Tabla `fight_trades` (incorrecto):**
| user_id | pacifica_history_id | symbol | side | amount | price | pnl | executed_at |
|---------|---------------------|--------|------|--------|-------|-----|-------------|
| cdd426cf... | 107534958 | BTC | BUY | 0.00037 | 94971 | -0.0246 | 19:37:36 |
| b7f48d15... | 107592912 | BTC | BUY | 0.00048 | 95250 | 0.8517 | 20:54:48 |

**Tabla `fight_snapshots`:** VACÍA (no se registra ningún snapshot)

### Problema

El trade `107534958` (BTC BUY 0.00037) del usuario A es un **cierre de posicion pre-fight**, pero:
1. Se registro en `fight_trades`
2. Su PnL (-0.0246) afecta el score del fight
3. El usuario A tenia `positions_at_start` vacio, lo que indica que el sistema no detecto la posicion pre-existente

### Investigación - Flujo Actual

**1. Crear Fight (`POST /api/fights` - apps/web/src/app/api/fights/route.ts)**
```typescript
// Linea 116-122: Creator se crea SIN initialPositions
await tx.fightParticipant.create({
  data: {
    fightId: newFight.id,
    userId: user.userId,
    slot: 'A',
    // ❌ NO HAY initialPositions aqui!
  },
});
```

**2. Join Fight (`POST /api/fights/[id]/join` - apps/web/src/app/api/fights/[id]/join/route.ts)**
```typescript
// Linea 91-98: Intenta capturar posiciones pero FALLA SILENCIOSAMENTE
const [creatorPositions, joinerPositions] = await Promise.all([
  creatorConnection?.accountAddress
    ? getPositions(creatorConnection.accountAddress).catch(() => [])  // ❌ Error silenciado
    : Promise.resolve([]),
  // ...
]);

// Linea 117-120: Actualiza creator con posiciones (pero ya estan vacias)
await tx.fightParticipant.updateMany({
  where: { fightId: params.id, slot: 'A' },
  data: { initialPositions: creatorInitialPositions }, // = [] si fallo
});
```

### Causa Raíz

1. **Falla silenciosa**: `getPositions().catch(() => [])` oculta cualquier error de la API de Pacifica
2. **Sin logging**: No se registra cuando falla el snapshot de posiciones
3. **Sin validación**: No se verifica que las posiciones se capturaron correctamente antes de iniciar el fight

### Comportamiento esperado

1. Al unirse al fight, el sistema debe guardar en `positions_at_start` TODAS las posiciones abiertas del usuario
2. Si falla la captura de posiciones, debe loguearse el error y posiblemente fallar el join
3. Trades que cierran posiciones pre-fight NO deben registrarse en `fight_trades`
4. Solo trades que abren/cierran posiciones DURANTE el fight deben contar

### Comportamiento actual

1. `positions_at_start` esta vacio para usuario A aunque tenia posicion abierta
2. El trade de cierre se registro como fight_trade
3. El PnL de ese trade afecta el resultado del fight

### Fix Propuesto

**1. Agregar logging cuando getPositions falla:**
```typescript
// En join/route.ts linea 92-98
const [creatorPositions, joinerPositions] = await Promise.all([
  creatorConnection?.accountAddress
    ? getPositions(creatorConnection.accountAddress).catch((err) => {
        console.error(`[JoinFight] Failed to get creator positions:`, err);
        return [];
      })
    : Promise.resolve([]),
  // ...
]);
```

**2. Validar que se capturaron posiciones (opcional - más estricto):**
```typescript
// Despues de capturar posiciones
console.log(`[JoinFight] Creator positions: ${JSON.stringify(creatorInitialPositions)}`);
console.log(`[JoinFight] Joiner positions: ${JSON.stringify(joinerInitialPositions)}`);
```

**3. Considerar capturar posiciones del creator al CREAR el fight (no solo al join):**
```typescript
// En POST /api/fights route.ts, al crear el participante A
const creatorPositions = await getPositions(connection.accountAddress).catch(() => []);
await tx.fightParticipant.create({
  data: {
    fightId: newFight.id,
    userId: user.userId,
    slot: 'A',
    initialPositions: creatorPositions, // ✅ Capturar desde el inicio
  },
});
```

### Archivos modificados

1. `apps/web/src/app/api/fights/route.ts` - ✅ Captura posiciones del creator al crear fight
2. `apps/web/src/app/api/fights/[id]/join/route.ts` - ✅ Logging detallado cuando falla getPositions

### Cambios realizados (2026-01-16)

**1. fights/route.ts - Captura posiciones al CREAR el fight:**
```typescript
// Snapshot creator's current positions from Pacifica
let creatorPositions = [];
if (connection.accountAddress) {
  try {
    const positions = await getPositions(connection.accountAddress);
    creatorPositions = positions.map((p) => ({
      symbol: p.symbol,
      amount: p.amount,
      entry_price: p.entry_price,
    }));
    console.log(`[CreateFight] Creator has ${creatorPositions.length} open positions`);
  } catch (err) {
    console.error(`[CreateFight] Failed to get creator positions:`, err);
  }
}

// Guardar en fightParticipant
await tx.fightParticipant.create({
  data: {
    fightId: newFight.id,
    userId: user.userId,
    slot: 'A',
    initialPositions: creatorPositions, // ✅ Ya no queda vacío
  },
});
```

**2. join/route.ts - Logging detallado:**
```typescript
// Ahora loguea errores en lugar de silenciarlos
getPositions(creatorConnection.accountAddress).catch((err) => {
  console.error(`[JoinFight] Failed to get creator positions:`, err);
  return [];
})

// Logging detallado de posiciones capturadas
console.log(`[JoinFight] Fight ${params.id} - Position snapshots:`);
console.log(`  Creator: ${creatorPositions.length} positions`, JSON.stringify(...));
console.log(`  Joiner: ${joinerPositions.length} positions`, JSON.stringify(...));
```

### Estado

🟡 Fix parcial aplicado - Ver Fix #2 abajo

### Fix #2 - Campo `side` faltante (2026-01-16)

**Causa raíz encontrada:**

El código guardaba las posiciones pre-fight SIN el campo `side`:
```typescript
// Antes (incorrecto):
{ symbol: "HYPE", amount: "0.62", entry_price: "24.72" }

// Pacifica SIEMPRE devuelve amounts positivos con side separado:
// side: "bid" = LONG, side: "ask" = SHORT
```

La lógica de filtrado en `orders/route.ts` asumía:
- `amount` positivo = LONG
- `amount` negativo = SHORT

Pero como TODOS los amounts son positivos, TODAS las posiciones se trataban como LONG.

**Archivos modificados:**

1. `apps/web/src/app/api/fights/route.ts` - Guardar `side` al crear fight
2. `apps/web/src/app/api/fights/[id]/join/route.ts` - Guardar `side` al unirse
3. `apps/web/src/app/api/orders/route.ts` - Usar `side` para calcular `initialAmount` con signo

**Cambio clave en orders/route.ts:**
```typescript
// Antes:
const initialAmount = initialPos ? parseFloat(initialPos.amount) : 0;

// Después:
let initialAmount = 0;
if (initialPos) {
  const absAmount = parseFloat(initialPos.amount);
  // Si side es 'ask' (SHORT), hacerlo negativo
  initialAmount = initialPos.side === 'ask' ? -absAmount : absAmount;
}
```

### Estado Final

🟢 Fix completo aplicado - Pendiente verificación en próximo fight

---

## 3. Open Orders muestra Original Size como 0.00000000

**Fecha:** 2026-01-16
**Componente:** Trade page - Open Orders table

### Descripcion

La columna "Original Size" en la tabla de Open Orders muestra "0.00000000 BTC" en lugar del valor correcto (ej: "0.00037 BTC").

### Evidencia

- TFC muestra: `0.00000000 BTC`
- Pacifica muestra: `0.00037 BTC`

### Causa identificada

El campo `initial_amount` de la API REST de Pacifica puede venir con un nombre diferente (`amount` o `size`). El codigo solo buscaba `initial_amount`.

### Fix aplicado

En `useAccount.ts` linea 158:
```typescript
// Antes:
size: order.initial_amount || '0',

// Despues:
size: order.initial_amount || order.amount || order.size || '0',
```

### Estado

🟡 Fix aplicado - Pendiente verificacion con logs de consola

