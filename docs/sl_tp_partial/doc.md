# Partial TP/SL - Problema y Solución

## Resumen del Problema

Las órdenes parciales de TP/SL creadas desde TFC no aparecían en el modal de TP/SL, pero las creadas directamente desde Pacifica sí aparecían.

## Fecha: 2026-02-04

---

## Contexto Técnico

### Endpoint `set_position_tpsl` (Pacifica nativo)
- **Limitación**: Solo soporta TP/SL para la posición COMPLETA
- **Problema**: Sobrescribe órdenes TP/SL existentes
- **No soporta**: Parámetro `amount` o `size` para órdenes parciales

### Solución Híbrida Implementada

Para soportar TP/SL parciales, implementamos un enfoque híbrido:

| Tipo de Orden | Implementación | Endpoint |
|---------------|----------------|----------|
| **Take Profit** | Limit order con `reduce_only: true` | `/api/orders` (tipo LIMIT) |
| **Stop Loss** | Stop order con `reduce_only: true` | `/api/orders/stop/create` |

**¿Por qué híbrido?**
- Stop orders de Pacifica solo funcionan para SL (trigger cuando precio va en contra)
- Para TP, necesitamos limit orders que ejecutan cuando precio alcanza el nivel

---

## El Bug

### Síntoma
- Órdenes parciales creadas desde TFC: **NO aparecían** en el modal de Partial TP/SL
- Órdenes creadas desde Pacifica: **SÍ aparecían** en el modal

### Causa Raíz

El filtro de detección de TP/SL en `apps/web/src/app/trade/page.tsx` solo buscaba tipos de orden específicos:

```typescript
// ANTES - Solo detectaba órdenes nativas de Pacifica
const isTP = order.type?.includes('TP') || order.type?.toLowerCase().includes('take_profit');
const isSL = order.type?.includes('SL') || order.type?.toLowerCase().includes('stop_loss');
```

**Tipos de orden según origen:**

| Origen | Tipo de Orden | Detectado? |
|--------|---------------|------------|
| Pacifica `set_position_tpsl` | `take_profit_market` → "TP MARKET" | ✅ Sí |
| Pacifica `set_position_tpsl` | `stop_loss_market` → "SL MARKET" | ✅ Sí |
| TFC híbrido (TP) | `limit` → "LIMIT" | ❌ No |
| TFC híbrido (SL) | `stop_market` → "STOP_MARKET" | ❌ No |

---

## Solución Implementada

### Archivo: `apps/web/src/app/trade/page.tsx` (líneas 761-822)

Expandimos la lógica de detección para incluir órdenes híbridas:

```typescript
// AHORA - Detecta tanto órdenes nativas como híbridas

// Para TP:
const isNativeTP = order.type?.includes('TP') || order.type?.toLowerCase().includes('take_profit');
if (isNativeTP) return true;

// Detectar TP híbrido: limit orders reduce_only en precio de ganancia
const isLimitOrder = order.type?.toUpperCase() === 'LIMIT';
if (isLimitOrder && order.reduceOnly) {
  const orderPrice = parseFloat(order.price) || 0;
  // LONG: TP está ARRIBA del entry (ganancia si sube)
  // SHORT: TP está DEBAJO del entry (ganancia si baja)
  if (pos.side === 'LONG' && orderPrice > entryPrice) return true;
  if (pos.side === 'SHORT' && orderPrice < entryPrice) return true;
}

// Para SL:
const isNativeSL = order.type?.includes('SL') || order.type?.toLowerCase().includes('stop_loss');
if (isNativeSL) return true;

// Detectar SL híbrido: stop orders reduce_only en precio de pérdida
const isStopOrder = order.type?.toUpperCase().includes('STOP') && !order.type?.includes('TP') && !order.type?.includes('SL');
if (isStopOrder && order.reduceOnly) {
  const triggerPrice = parseFloat(order.stopPrice || order.price) || 0;
  // LONG: SL está DEBAJO del entry (pérdida si baja)
  // SHORT: SL está ARRIBA del entry (pérdida si sube)
  if (pos.side === 'LONG' && triggerPrice < entryPrice) return true;
  if (pos.side === 'SHORT' && triggerPrice > entryPrice) return true;
}
```

---

## Lógica de Detección por Posición

### Posición LONG (entry: $100)
| Orden | Precio | Detección |
|-------|--------|-----------|
| Limit reduce_only | $110 | TP (arriba del entry = ganancia) |
| Limit reduce_only | $90 | ❌ No es TP (sería pérdida) |
| Stop reduce_only | $90 | SL (debajo del entry = pérdida) |
| Stop reduce_only | $110 | ❌ No es SL (sería ganancia) |

### Posición SHORT (entry: $100)
| Orden | Precio | Detección |
|-------|--------|-----------|
| Limit reduce_only | $90 | TP (debajo del entry = ganancia) |
| Limit reduce_only | $110 | ❌ No es TP (sería pérdida) |
| Stop reduce_only | $110 | SL (arriba del entry = pérdida) |
| Stop reduce_only | $90 | ❌ No es SL (sería ganancia) |

---

## Archivos Modificados

1. **`apps/web/src/app/trade/page.tsx`** - Lógica de detección de TP/SL
2. **`apps/web/src/hooks/useOrders.ts`** - Hook `useCreateStopOrder` con enfoque híbrido
3. **`apps/web/src/lib/pacifica/signing.ts`** - Función `createSignedStopOrder`
4. **`apps/web/src/lib/pacifica/api-client.ts`** - Función `createStopOrder`
5. **`apps/web/src/app/api/orders/stop/create/route.ts`** - API route para crear stop orders

---

## Verificación

Para verificar que funciona correctamente:

1. Abrir una posición (LONG o SHORT)
2. Ir al modal TP/SL → pestaña "Partial"
3. Crear una orden TP parcial (ej. 50% de la posición)
4. Crear una orden SL parcial
5. Verificar que ambas aparecen en el modal de Partial
6. Verificar que las órdenes existentes NO se sobrescriben

---

## Notas Adicionales

- Las órdenes TP híbridas aparecen como "Limit Order" en la tabla de Open Orders (no como "TP MARKET")
- Las órdenes SL híbridas aparecen como "STOP_MARKET" en la tabla de Open Orders (no como "SL MARKET")
- Esto es cosmético - la funcionalidad es la misma
- El modal de Partial las detecta correctamente basándose en `reduceOnly` y precio relativo al entry
