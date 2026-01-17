# Pacifica Signing Guide

Esta guía explica exactamente cómo firmar operaciones para Pacifica API.

## ⚠️ Estructura del Mensaje a Firmar

El mensaje que debes firmar con el wallet **NO es el payload completo**. Debe tener esta estructura específica:

```typescript
{
  "timestamp": number,        // Date.now()
  "expiry_window": 5000,      // Milisegundos de validez
  "type": "create_market_order",  // Tipo de operación
  "data": {
    // TODOS los parámetros EXCEPTO:
    // - timestamp
    // - expiry_window
    // - signature
  }
}
```

## 🔑 Pasos para Firmar Correctamente

### 1. Preparar el Data Object

```typescript
const dataToSign = {
  timestamp: Date.now(),
  expiry_window: 5000,
  type: 'create_market_order',
  data: {
    account: '6WZ3JC47tb55EdJ81GwjVxksF6pGvxvbNom28ZqLqVaU',
    symbol: 'BTC',
    side: 'bid',
    amount: '0.001105',
    slippage_percent: '0.5',
    reduce_only: false,
    builder_code: 'TradeClub',
    // Incluir take_profit/stop_loss solo si existen
    // NO incluir undefined
  }
};
```

**⚠️ IMPORTANTE**:
- NO incluir `timestamp`, `expiry_window`, `signature` dentro de `data`
- NO incluir campos `undefined` - deben ser omitidos completamente
- `take_profit` y `stop_loss` solo si tienen valor

### 2. Ordenar Keys Recursivamente

```typescript
function recursivelySortJson(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => recursivelySortJson(item));
  }

  if (typeof obj === 'object') {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = recursivelySortJson((obj as Record<string, unknown>)[key]);
    }

    return sortedObj;
  }

  return obj;
}
```

### 3. Convertir a JSON Compacto

```typescript
const sortedData = recursivelySortJson(dataToSign);
const message = JSON.stringify(sortedData); // Sin espacios
```

**Ejemplo de mensaje final:**
```json
{"data":{"account":"6WZ3JC47tb55EdJ81GwjVxksF6pGvxvbNom28ZqLqVaU","amount":"0.001105","builder_code":"TradeClub","reduce_only":false,"side":"bid","slippage_percent":"0.5","symbol":"BTC"},"expiry_window":5000,"timestamp":1767996054257,"type":"create_market_order"}
```

**Nota**: Las keys están ordenadas alfabéticamente: `account` → `amount` → `builder_code` → etc.

### 4. Firmar con Wallet

```typescript
const messageBytes = new TextEncoder().encode(message);
const signatureBytes = await wallet.signMessage(messageBytes);
const signature = bs58.encode(signatureBytes);
```

### 5. Crear Request Body

```typescript
const requestBody = {
  // Todos los campos del data object original
  account: '6WZ3JC47tb55EdJ81GwjVxksF6pGvxvbNom28ZqLqVaU',
  symbol: 'BTC',
  side: 'bid',
  amount: '0.001105',
  slippage_percent: '0.5',
  reduce_only: false,
  builder_code: 'TradeClub',
  // Campos de control
  signature,
  timestamp,
  expiry_window: 5000,
  // take_profit/stop_loss solo si existen (NO undefined)
};
```

## 🐛 Errores Comunes

### Error: "Invalid message"

**Causa**: El mensaje firmado no coincide con el formato esperado por Pacifica.

**Soluciones**:

1. **Verificar estructura del mensaje**
   ```typescript
   // ❌ INCORRECTO - Firmando directamente los parámetros
   const dataToSign = {
     account: '...',
     symbol: 'BTC',
     side: 'bid',
     amount: '0.001',
     signature: '...',  // ❌ No incluir en firma
     timestamp: 123,    // ❌ Debe estar en root, no en data
   };

   // ✅ CORRECTO - Estructura con type y data
   const dataToSign = {
     timestamp: 123,
     expiry_window: 5000,
     type: 'create_market_order',
     data: {
       account: '...',
       symbol: 'BTC',
       side: 'bid',
       amount: '0.001',
       builder_code: 'TradeClub',
     }
   };
   ```

2. **Verificar campos undefined**
   ```typescript
   // ❌ INCORRECTO
   data: {
     account: '...',
     take_profit: undefined,  // ❌ No incluir undefined
     stop_loss: undefined,     // ❌ No incluir undefined
   }

   // ✅ CORRECTO - Omitir campos undefined
   data: {
     account: '...',
     // take_profit y stop_loss omitidos completamente
   }
   ```

3. **Verificar ordenamiento de keys**
   ```typescript
   // ❌ INCORRECTO - Keys sin ordenar
   {"symbol":"BTC","account":"...","side":"bid"}

   // ✅ CORRECTO - Keys ordenadas alfabéticamente
   {"account":"...","side":"bid","symbol":"BTC"}
   ```

4. **Verificar expiry_window**
   ```typescript
   // ❌ INCORRECTO - expiry_window en data
   {
     timestamp: 123,
     type: 'create_market_order',
     data: {
       account: '...',
       expiry_window: 5000  // ❌ No va aquí
     }
   }

   // ✅ CORRECTO - expiry_window en root
   {
     timestamp: 123,
     expiry_window: 5000,  // ✅ Va en root
     type: 'create_market_order',
     data: {
       account: '...',
     }
   }
   ```

## 📝 Ejemplo Completo

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

async function createMarketOrder() {
  const wallet = useWallet();

  // 1. Preparar parámetros (sin signature, timestamp)
  const orderParams = {
    account: wallet.publicKey!.toBase58(),
    symbol: 'BTC',
    side: 'bid' as const,
    amount: '0.001',
    slippage_percent: '0.5',
    reduce_only: false,
    builder_code: 'TradeClub',
  };

  // 2. Crear estructura de firma
  const timestamp = Date.now();
  const dataToSign = {
    timestamp,
    expiry_window: 5000,
    type: 'create_market_order',
    data: orderParams,
  };

  // 3. Ordenar keys recursivamente
  const sortedData = recursivelySortJson(dataToSign);

  // 4. Convertir a JSON compacto
  const message = JSON.stringify(sortedData);

  console.log('Message to sign:', message);

  // 5. Firmar
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = await wallet.signMessage!(messageBytes);
  const signature = bs58.encode(signatureBytes);

  // 6. Crear request body (AHORA incluir signature y timestamp)
  const requestBody = {
    ...orderParams,
    signature,
    timestamp,
    expiry_window: 5000,
  };

  console.log('Request body:', requestBody);

  // 7. Enviar a Pacifica
  const response = await fetch('https://api.pacifica.fi/api/v1/orders/create_market', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const result = await response.json();
  console.log('Result:', result);

  return result;
}

function recursivelySortJson(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(recursivelySortJson);

  if (typeof obj === 'object') {
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = recursivelySortJson((obj as Record<string, unknown>)[key]);
    }

    return sortedObj;
  }

  return obj;
}
```

## 🔍 Debug: Verificar Mensaje

Antes de firmar, imprime el mensaje para verificar:

```typescript
console.log('Message to sign:', message);

// Debe verse así (todo en una línea, keys ordenadas):
// {"data":{"account":"...","amount":"0.001","builder_code":"TradeClub","reduce_only":false,"side":"bid","slippage_percent":"0.5","symbol":"BTC"},"expiry_window":5000,"timestamp":1767996054257,"type":"create_market_order"}

// Verificar:
// 1. ✅ "type" está en root, no en data
// 2. ✅ "timestamp" está en root, no en data
// 3. ✅ "expiry_window" está en root, no en data
// 4. ✅ Keys ordenadas alfabéticamente en cada nivel
// 5. ✅ No hay campos undefined
// 6. ✅ JSON compacto (sin espacios)
```

## 📊 Comparación: Tu Error vs Correcto

### ❌ Tu Implementación Actual (Incorrecta)

```typescript
// Probablemente estás haciendo algo así:
const requestBody = {
  account: '...',
  symbol: 'BTC',
  side: 'bid',
  amount: '0.001105',
  slippage_percent: '0.5',
  reduce_only: false,
  builder_code: 'TradeClub',
  take_profit: undefined,  // ❌ undefined incluido
  stop_loss: undefined,    // ❌ undefined incluido
  signature: '...',
  timestamp: 123,
  expiry_window: 5000,
};

// Y firmando esto directamente (INCORRECTO)
const message = JSON.stringify(requestBody);
const signature = await signMessage(message);
```

**Resultado**: "Invalid message" porque Pacifica espera la estructura con `type` y `data`.

### ✅ Implementación Correcta

```typescript
// 1. Preparar data (sin signature, timestamp, expiry_window)
const orderData = {
  account: '...',
  symbol: 'BTC',
  side: 'bid',
  amount: '0.001105',
  slippage_percent: '0.5',
  reduce_only: false,
  builder_code: 'TradeClub',
  // take_profit/stop_loss omitidos (no undefined)
};

// 2. Crear estructura de firma
const timestamp = Date.now();
const dataToSign = {
  timestamp,
  expiry_window: 5000,
  type: 'create_market_order',
  data: orderData,  // ← Data dentro de "data"
};

// 3. Ordenar y firmar
const sortedData = recursivelySortJson(dataToSign);
const message = JSON.stringify(sortedData);
const signature = await signMessage(message);

// 4. Request body (AHORA añadir signature y timestamp)
const requestBody = {
  ...orderData,
  signature,
  timestamp,
  expiry_window: 5000,
};
```

**Resultado**: ✅ Firma válida, orden aceptada.

## 🎯 Resumen: 3 Pasos Clave

1. **Firma**: Estructura `{ timestamp, expiry_window, type, data: {...} }`
2. **Ordenar**: Keys alfabéticamente con `recursivelySortJson()`
3. **Request**: Todos los campos + `signature` + `timestamp` + `expiry_window`

## 🔗 Referencia Completa

Ver implementación en:
- `/apps/web/src/lib/pacifica/signing.ts` - Función `signPacificaOperation()`
- `/apps/web/src/app/(private)/terminal/hooks/use-create-order.ts` - Ejemplo de uso

---

**Nota Final**: El error "Invalid message" casi siempre significa que la estructura del mensaje firmado es incorrecta. Verifica:
1. Estructura con `type` y `data`
2. Keys ordenadas alfabéticamente
3. Sin campos `undefined`
4. `expiry_window` en root, no en data
