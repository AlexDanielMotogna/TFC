# URL State Persistence

Esta documentacion describe como implementar persistencia de estado en la URL para la aplicacion TradeFightClub.

## Resumen

La persistencia de estado en URL permite que:
- **Refresh** mantenga el estado actual (ej: tab seleccionado)
- **Back/Forward** del navegador funcione correctamente
- **Compartir URLs** con estado especifico (ej: `/lobby?tab=finished`)
- **Bookmarks** guarden el estado

## Paginas con URL State

| Pagina | Parametro | Valores | Default |
|--------|-----------|---------|---------|
| `/lobby` | `tab` | `live`, `pending`, `finished`, `my-fights` | `live` |
| `/leaderboard` | `range` | `weekly`, `all_time` | `weekly` |
| `/trade` | `symbol` | `BTC-USD`, `ETH-USD`, etc. | `BTC-USD` |
| `/trade` | `tab` | `positions`, `orders`, `trades`, `history` | `positions` |
| `/referrals` | `tab` | `overview`, `referrals`, `payouts` | `overview` |

## Ejemplos de URLs

```
/lobby                     # Tab: live (default)
/lobby?tab=finished        # Tab: finished
/lobby?tab=my-fights       # Tab: my-fights

/leaderboard               # Range: weekly (default)
/leaderboard?range=all_time # Range: all_time

/trade                     # Symbol: BTC-USD, Tab: positions
/trade?symbol=ETH-USD      # Symbol: ETH-USD
/trade?symbol=SOL-USD&tab=orders  # Symbol: SOL-USD, Tab: orders

/referrals                 # Tab: overview (default)
/referrals?tab=payouts     # Tab: payouts
/referrals?tab=referrals   # Tab: referrals
```

## Hook: useUrlState

El hook `useUrlState` encapsula la logica de sincronizacion con URL.

### Instalacion

```typescript
import { useUrlState } from '@/hooks';
```

### API

```typescript
const [value, setValue] = useUrlState<T>({
  key: string;         // Nombre del parametro en URL
  defaultValue: T;     // Valor por defecto
  validValues: T[];    // Valores permitidos (validacion)
  basePath: string;    // Ruta base de la pagina
});
```

### Ejemplo Basico

```typescript
// En /lobby/page.tsx
type ArenaTab = 'live' | 'pending' | 'finished' | 'my-fights';

const [activeTab, setActiveTab] = useUrlState<ArenaTab>({
  key: 'tab',
  defaultValue: 'live',
  validValues: ['live', 'pending', 'finished', 'my-fights'],
  basePath: '/lobby',
});

// Usar como useState normal
<button onClick={() => setActiveTab('finished')}>
  Finished
</button>
```

### Ejemplo Avanzado (Multiple Parameters)

```typescript
import { useMultipleUrlState } from '@/hooks';

const { get, set, setMultiple } = useMultipleUrlState('/trade');

// Obtener valores
const symbol = get('symbol', 'BTC-USD', ['BTC-USD', 'ETH-USD', 'SOL-USD']);
const tab = get('tab', 'positions', ['positions', 'orders', 'trades', 'history']);

// Establecer un valor
set('symbol', 'ETH-USD', 'BTC-USD'); // Tercer param = default (opcional)

// Establecer multiples valores
setMultiple({
  symbol: 'SOL-USD',
  tab: 'orders',
});
```

## Implementacion Manual

Si prefieres no usar el hook, puedes implementar el patron manualmente:

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type MyTab = 'a' | 'b' | 'c';
const VALID_TABS: MyTab[] = ['a', 'b', 'c'];

export default function MyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 1. Funcion para leer valor de URL
  const getTabFromUrl = useCallback((): MyTab => {
    const param = searchParams.get('tab');
    if (param && VALID_TABS.includes(param as MyTab)) {
      return param as MyTab;
    }
    return 'a'; // default
  }, [searchParams]);

  // 2. Estado inicializado desde URL
  const [tab, setTabState] = useState<MyTab>(getTabFromUrl);

  // 3. Setter que actualiza URL
  const setTab = useCallback((newTab: MyTab) => {
    setTabState(newTab);

    const params = new URLSearchParams(searchParams.toString());
    if (newTab === 'a') {
      params.delete('tab'); // No mostrar default en URL
    } else {
      params.set('tab', newTab);
    }

    const url = params.toString() ? `/my-page?${params}` : '/my-page';
    router.replace(url, { scroll: false });
  }, [router, searchParams]);

  // 4. Sincronizar cuando cambia URL (back/forward)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl();
    if (tabFromUrl !== tab) {
      setTabState(tabFromUrl);
    }
  }, [searchParams, getTabFromUrl]);

  return (
    <button onClick={() => setTab('b')}>Tab B</button>
  );
}
```

## Consideraciones

### Valores Default

- Los valores default **NO se muestran en URL** para mantener URLs limpias
- Ej: `/lobby` es equivalente a `/lobby?tab=live`

### Validacion

- Valores invalidos en URL se ignoran y se usa el default
- Previene errores si alguien manipula la URL

### Scroll

- Se usa `{ scroll: false }` para evitar scroll al top al cambiar estado

### SSR

- `useSearchParams()` puede ser `null` en el primer render (SSR)
- El hook maneja esto con optional chaining (`searchParams?.get()`)

## Testing

Para probar la persistencia de URL:

1. **Refresh Test**
   - Cambia a un tab no-default
   - Refresca la pagina
   - Debe mantener el tab

2. **Back/Forward Test**
   - Navega entre tabs
   - Usa el boton back del navegador
   - Debe volver al tab anterior

3. **Direct URL Test**
   - Abre `/lobby?tab=finished` directamente
   - Debe mostrar el tab finished

4. **Invalid URL Test**
   - Abre `/lobby?tab=invalid`
   - Debe mostrar el tab default (live)
