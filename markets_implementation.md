# Markets Implementation Guide

Esta guía documenta cómo se reciben los markets de Pacifica y cómo se muestran en la UI.

## 🔑 Respuesta Rápida: ¿Dinámico o Hardcoded?

**✅ DINÁMICO** - Los markets vienen de la API de Pacifica, no están hardcodeados.

- La lista de markets viene de `GET /api/v1/info`
- Los precios son real-time via WebSocket
- Hay mock data como fallback mientras carga la API
- El único valor hardcodeado es el market **default** (SOL-USD)

---

## Tabla de Contenidos

1. [API Endpoints](#api-endpoints)
2. [Hooks de React Query](#hooks-de-react-query)
3. [Schemas de Datos](#schemas-de-datos)
4. [Market Selector Component](#market-selector-component)
5. [State Management](#state-management)
6. [WebSocket Real-Time](#websocket-real-time)
7. [Flujo de Datos Completo](#flujo-de-datos-completo)

---

## API Endpoints

### 1. Market Info (Metadata)

**Endpoint**: `GET /api/v1/info`

```bash
curl https://api.pacifica.fi/api/v1/info
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "tick_size": "1",
      "min_tick": "0",
      "max_tick": "1000000",
      "lot_size": "0.00001",
      "max_leverage": 50,
      "isolated_only": false,
      "min_order_size": "10",
      "max_order_size": "5000000",
      "funding_rate": "0.00001131",
      "next_funding_rate": "0.0000125",
      "created_at": 1748881333944
    },
    {
      "symbol": "ETH",
      "tick_size": "0.1",
      "lot_size": "0.0001",
      "max_leverage": 50,
      ...
    },
    {
      "symbol": "SOL",
      "tick_size": "0.01",
      "lot_size": "0.01",
      "max_leverage": 20,
      ...
    }
    // ... más markets
  ]
}
```

### 2. Prices (Real-Time)

**Endpoint**: `GET /api/v1/info/prices`

```bash
curl https://api.pacifica.fi/api/v1/info/prices
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "mark": "97500.50",
      "oracle": "97500.00",
      "mid": "97500.25",
      "funding": "0.00001131",
      "next_funding": "0.0000125",
      "open_interest": "15000000",
      "volume_24h": "250000000",
      "yesterday_price": "95000.00",
      "timestamp": 1767996054257
    },
    {
      "symbol": "SOL",
      "mark": "185.50",
      ...
    }
    // ... más precios
  ]
}
```

---

## Hooks de React Query

**Archivo**: [apps/web/src/app/(private)/terminal/hooks/use-market-data.ts](apps/web/src/app/(private)/terminal/hooks/use-market-data.ts)

### useMarketInfo()

Obtiene la lista de markets con su configuración:

```typescript
export function useMarketInfo() {
  return useQuery({
    queryKey: ['pacifica', 'markets'],
    queryFn: async () => {
      const response = await pacificaApiClient.getMarketInfo();
      return response.data;
    },
    refetchInterval: 60000,  // Refetch cada 60 segundos
    staleTime: 30000,        // Considera stale después de 30s
  });
}
```

**Retorna**: `MarketInfo[]` - Lista de todos los markets disponibles

### usePrices()

Obtiene precios actuales de todos los markets:

```typescript
export function usePrices() {
  return useQuery({
    queryKey: ['pacifica', 'prices'],
    queryFn: async () => {
      const response = await pacificaApiClient.getPrices();
      return response.data;
    },
    refetchInterval: 2000,   // Fallback polling cada 2 segundos
    staleTime: 1000,         // Considera stale después de 1s
  });
}
```

**Retorna**: `PriceData[]` - Precios de todos los markets

### useSymbolMarket(symbol)

Obtiene info de un market específico:

```typescript
export function useSymbolMarket(symbol: string | null) {
  const { data: markets } = useMarketInfo();

  return useMemo(() => {
    if (!markets || !symbol) return null;
    return markets.find((m) => m.symbol === symbol) ?? null;
  }, [markets, symbol]);
}
```

### useSymbolPrice(symbol)

Obtiene el precio de un symbol específico:

```typescript
export function useSymbolPrice(symbol: string | null) {
  const { data: prices } = usePrices();

  return useMemo(() => {
    if (!prices || !symbol) return null;
    return prices.find((p) => p.symbol === symbol) ?? null;
  }, [prices, symbol]);
}
```

---

## Schemas de Datos

**Archivo**: [packages/shared/src/schemas/pacifica/market.ts](packages/shared/src/schemas/pacifica/market.ts)

### MarketInfo Schema

```typescript
export const marketInfoSchema = z.object({
  symbol: z.string(),              // "BTC", "ETH", "SOL"
  tick_size: z.string(),           // Precisión de precio "0.01"
  min_tick: z.string(),
  max_tick: z.string(),
  lot_size: z.string(),            // Tamaño mínimo de orden "0.01"
  max_leverage: z.number(),        // Apalancamiento máximo (50, 20, etc.)
  isolated_only: z.boolean(),      // Solo soporta margin aislado
  min_order_size: z.string(),      // Mínimo en USD "10"
  max_order_size: z.string(),      // Máximo en USD "5000000"
  funding_rate: z.string(),        // Funding rate actual
  next_funding_rate: z.string(),   // Próximo funding rate
  created_at: z.number(),          // Timestamp de creación
});

export type MarketInfo = z.infer<typeof marketInfoSchema>;
```

### PriceData Schema

```typescript
export const priceDataSchema = z.object({
  symbol: z.string(),
  mark: z.string(),                // Precio mark actual "97500.50"
  oracle: z.string(),              // Precio oracle "97500.00"
  mid: z.string(),                 // Precio mid "97500.25"
  funding: z.string(),             // Funding rate actual
  next_funding: z.string(),        // Próximo funding rate
  open_interest: z.string(),       // Open interest en USD
  volume_24h: z.string(),          // Volumen 24h en USD
  yesterday_price: z.string(),     // Precio de ayer (para calcular 24h change)
  timestamp: z.number(),
});

export type PriceData = z.infer<typeof priceDataSchema>;
```

---

## Market Selector Component

**Archivo**: [apps/web/src/app/(private)/terminal/components/market-selector.tsx](apps/web/src/app/(private)/terminal/components/market-selector.tsx)

### Interface PerpMarket

El componente transforma los datos de la API a este formato interno:

```typescript
export interface PerpMarket {
  symbol: string;          // "BTC-USD"
  icon: string;            // "B" (primera letra)
  iconBg: string;          // Gradient CSS class
  maxLeverage: number;     // 50
  markPrice: number;       // 97500.50
  change24h: number;       // +2.63 (porcentaje)
  nextFunding: number;     // 0.00125 (ya multiplicado por 100)
  volume24h: number;       // 250000000
  openInterest: number;    // 15000000
  isFavorite?: boolean;    // true para BTC, ETH, SOL
}
```

### Transformación de Datos API → UI

```typescript
const { data: marketInfoData } = useMarketInfo();
const { data: pricesData } = usePrices();

const markets = useMemo(() => {
  // Si no hay datos de API, usar mock data
  if (!marketInfoData || !pricesData) {
    return generateMockPerpMarkets();
  }

  // Transformar cada market de la API
  return marketInfoData.map((marketInfo) => {
    // Buscar precio correspondiente
    const priceInfo = pricesData.find((p) => p.symbol === marketInfo.symbol);

    // Calcular cambio 24h
    const markPrice = parseFloat(priceInfo?.mark || '0');
    const yesterdayPrice = parseFloat(priceInfo?.yesterday_price || '0');
    const change24h = yesterdayPrice > 0
      ? ((markPrice - yesterdayPrice) / yesterdayPrice) * 100
      : 0;

    // Obtener icono y color
    const { icon, iconBg } = getSymbolIconAndColor(marketInfo.symbol);

    return {
      symbol: `${marketInfo.symbol}-USD`,  // Añadir sufijo -USD
      icon,
      iconBg,
      maxLeverage: marketInfo.max_leverage,
      markPrice,
      change24h,
      nextFunding: parseFloat(priceInfo?.next_funding || '0') * 100,
      volume24h: parseFloat(priceInfo?.volume_24h || '0'),
      openInterest: parseFloat(priceInfo?.open_interest || '0'),
      isFavorite: ['BTC', 'ETH', 'SOL'].includes(marketInfo.symbol),
    };
  });
}, [marketInfoData, pricesData]);
```

### Helper: Icono y Color por Symbol

```typescript
const getSymbolIconAndColor = (symbol: string) => {
  const symbolConfig: Record<string, { icon: string; iconBg: string }> = {
    BTC: { icon: '₿', iconBg: 'from-orange-500 to-orange-700' },
    ETH: { icon: 'Ξ', iconBg: 'from-blue-500 to-purple-700' },
    SOL: { icon: 'S', iconBg: 'from-purple-500 to-purple-700' },
    DOGE: { icon: 'D', iconBg: 'from-yellow-400 to-yellow-600' },
    XRP: { icon: 'X', iconBg: 'from-gray-400 to-gray-600' },
    // ... más symbols
  };

  return symbolConfig[symbol] ?? {
    icon: symbol.charAt(0),
    iconBg: 'from-gray-500 to-gray-700',
  };
};
```

### Mock Data (Fallback mientras carga API)

```typescript
function generateMockPerpMarkets(): PerpMarket[] {
  return [
    {
      symbol: 'BTC-USD',
      icon: '₿',
      iconBg: 'from-orange-500 to-orange-700',
      maxLeverage: 50,
      markPrice: 0,      // Se actualiza cuando lleguen datos reales
      change24h: 0,
      nextFunding: 0,
      volume24h: 0,
      openInterest: 0,
      isFavorite: true,
    },
    {
      symbol: 'ETH-USD',
      icon: 'Ξ',
      iconBg: 'from-blue-500 to-purple-700',
      maxLeverage: 50,
      markPrice: 0,
      // ...
    },
    {
      symbol: 'SOL-USD',
      // ...
    },
    // Más markets de fallback
  ];
}
```

### Búsqueda y Filtrado

```typescript
const [searchQuery, setSearchQuery] = useState('');

const filteredMarkets = useMemo(() => {
  if (!searchQuery) return markets;

  return markets.filter((market) =>
    market.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [markets, searchQuery]);
```

### UI del Selector

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${selectedMarket.iconBg}`}>
        {selectedMarket.icon}
      </div>
      <span>{selectedMarket.symbol}</span>
      <ChevronDown />
    </Button>
  </PopoverTrigger>

  <PopoverContent className="w-[700px]">
    {/* Search Input */}
    <Input
      placeholder="Search markets..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />

    {/* Markets Table */}
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Mark Price</th>
          <th>24h Change</th>
          <th>Next Funding</th>
          <th>24h Volume</th>
          <th>Open Interest</th>
        </tr>
      </thead>
      <tbody>
        {filteredMarkets.map((market) => (
          <tr
            key={market.symbol}
            onClick={() => handleSelectMarket(market)}
            className={cn(
              'cursor-pointer hover:bg-neutral-800',
              selectedMarket.symbol === market.symbol && 'bg-neutral-700'
            )}
          >
            <td>
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${market.iconBg}`}>
                {market.icon}
              </div>
              {market.symbol}
            </td>
            <td>${formatPrice(market.markPrice)}</td>
            <td className={market.change24h >= 0 ? 'text-green-500' : 'text-red-500'}>
              {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
            </td>
            <td>{market.nextFunding.toFixed(4)}%</td>
            <td>${formatVolume(market.volume24h)}</td>
            <td>${formatVolume(market.openInterest)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </PopoverContent>
</Popover>
```

---

## State Management

**Archivo**: [apps/web/src/app/(private)/terminal/page.tsx](apps/web/src/app/(private)/terminal/page.tsx)

### Estado del Market Seleccionado

```typescript
// Default market: SOL-USD (hardcodeado)
const [selectedMarket, setSelectedMarket] = useState<PerpMarket>({
  symbol: 'SOL-USD',
  icon: 'S',
  iconBg: 'from-purple-500 to-purple-700',
  maxLeverage: 20,
  markPrice: 0,
  change24h: 0,
  nextFunding: 0,
  volume24h: 0,
  openInterest: 0,
  isFavorite: true,
});
```

### Uso del Market en la Página

```tsx
// Terminal Page
export default function TerminalPage() {
  const [selectedMarket, setSelectedMarket] = useState<PerpMarket>({ /* default */ });

  // Convertir symbol para API calls (quitar -USD)
  const apiSymbol = selectedMarket.symbol.replace('-USD', '');

  return (
    <div>
      {/* Market Selector */}
      <MarketSelector
        selectedMarket={selectedMarket}
        onSelectMarket={setSelectedMarket}
      />

      {/* Trading Chart - usa apiSymbol */}
      <TradingChart symbol={apiSymbol} />

      {/* Order Book - usa apiSymbol */}
      <OrderBook symbol={apiSymbol} />

      {/* Order Form - usa selectedMarket completo */}
      <OrderForm
        symbol={apiSymbol}
        maxLeverage={selectedMarket.maxLeverage}
        markPrice={selectedMarket.markPrice}
      />

      {/* Positions Table - filtra por apiSymbol opcionalmente */}
      <PositionsTable />
    </div>
  );
}
```

### Propagación del Market

```
selectedMarket (state)
        ↓
┌───────┼───────────────────────────────┐
↓       ↓           ↓           ↓       ↓
Chart  OrderBook  OrderForm  Positions  Stats
 ↓       ↓           ↓
symbol  symbol     symbol + maxLeverage + markPrice
```

---

## WebSocket Real-Time

**Archivo**: [apps/web/src/providers/pacifica-websocket-provider.tsx](apps/web/src/providers/pacifica-websocket-provider.tsx)

### Suscripción a Precios

```typescript
export function usePacificaPrices(callback: (prices: WsPriceData[]) => void) {
  const client = useContext(PacificaWebSocketContext);

  useEffect(() => {
    if (!client) return;

    // Suscribirse al canal de precios (todos los symbols)
    return client.subscribe('prices', {}, (data) => {
      callback(data);
    });
  }, [client, callback]);
}
```

### Actualización del Cache

```typescript
// En terminal/page.tsx
const queryClient = useQueryClient();

usePacificaPrices((updatedPrices) => {
  // Actualizar cache de React Query directamente
  queryClient.setQueryData(['pacifica', 'prices'], updatedPrices);
});
```

### Formato WebSocket de Precios

```json
{
  "source": "prices",
  "data": [
    {
      "symbol": "BTC",
      "mark": "97500.50",
      "oracle": "97500.00",
      "funding": "0.00001131",
      "next_funding": "0.0000125",
      "volume_24h": "250000000",
      "open_interest": "15000000",
      "yesterday_price": "95000.00",
      "timestamp": 1767996054257
    },
    // ... todos los symbols
  ]
}
```

---

## Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    PACIFICA API                                  │
│                                                                  │
│  GET /api/v1/info          GET /api/v1/info/prices             │
│  (Market metadata)         (Real-time prices)                   │
└────────────┬────────────────────────┬────────────────────────────┘
             ↓                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              PACIFICA API CLIENT                                 │
│                                                                  │
│  getMarketInfo()              getPrices()                       │
└────────────┬────────────────────────┬────────────────────────────┘
             ↓                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              REACT QUERY HOOKS                                   │
│                                                                  │
│  useMarketInfo()              usePrices()                       │
│  [60s refresh]                [2s refresh / WS real-time]       │
└────────────┬────────────────────────┬────────────────────────────┘
             ↓                        ↓
┌─────────────────────────────────────────────────────────────────┐
│              MARKET SELECTOR COMPONENT                           │
│                                                                  │
│  1. Combina marketInfo + prices                                 │
│  2. Transforma a PerpMarket[]                                   │
│  3. Calcula 24h change                                          │
│  4. Añade iconos y colores                                      │
│  5. Filtra por búsqueda                                         │
│  6. Renderiza tabla                                             │
└────────────┬─────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────────┐
│              TERMINAL PAGE STATE                                 │
│                                                                  │
│  selectedMarket = useState<PerpMarket>()                        │
│                                                                  │
│  - Default: SOL-USD                                             │
│  - Actualiza cuando usuario selecciona                          │
└────────────┬─────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────────┐
│              CHILD COMPONENTS                                    │
│                                                                  │
│  TradingChart(symbol)     OrderBook(symbol)                     │
│  OrderForm(symbol, maxLeverage)                                 │
│  MarketStats(symbol)                                            │
└──────────────────────────────────────────────────────────────────┘

         ║
         ║  PARALLEL: WebSocket Real-Time
         ↓
┌─────────────────────────────────────────────────────────────────┐
│              WEBSOCKET (wss://api.pacifica.fi/ws)               │
│                                                                  │
│  Subscribe: { source: "prices" }                                │
│                    ↓                                             │
│  Receive: PriceData[] for all symbols                           │
│                    ↓                                             │
│  queryClient.setQueryData(['pacifica', 'prices'], newData)      │
│                    ↓                                             │
│  Components re-render with latest prices                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Resumen

### ¿Qué es Dinámico?

| Aspecto | Fuente | Frecuencia |
|---------|--------|------------|
| **Lista de markets** | API `/api/v1/info` | 60 segundos |
| **Precios (mark, oracle)** | WebSocket `prices` | Real-time |
| **24h Change** | Calculado desde `yesterday_price` | Real-time |
| **Funding Rate** | API + WebSocket | Real-time |
| **Volume 24h** | API + WebSocket | Real-time |
| **Open Interest** | API + WebSocket | Real-time |
| **Max Leverage** | API `/api/v1/info` | 60 segundos |

### ¿Qué está Hardcodeado?

| Aspecto | Valor | Razón |
|---------|-------|-------|
| **Default market** | SOL-USD | UX - necesita un default |
| **Favoritos** | BTC, ETH, SOL | UX - markets populares |
| **Iconos/Colores** | Mapping por symbol | UI - diseño visual |
| **Mock data** | 12 markets | Fallback mientras carga API |

### Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| [api-client.ts](apps/web/src/lib/pacifica/api-client.ts) | Llamadas a API |
| [use-market-data.ts](apps/web/src/app/(private)/terminal/hooks/use-market-data.ts) | Hooks de React Query |
| [market-selector.tsx](apps/web/src/app/(private)/terminal/components/market-selector.tsx) | UI del selector |
| [page.tsx](apps/web/src/app/(private)/terminal/page.tsx) | State management |
| [market.ts](packages/shared/src/schemas/pacifica/market.ts) | Schemas Zod |
| [pacifica-websocket-provider.tsx](apps/web/src/providers/pacifica-websocket-provider.tsx) | WebSocket |

---

## Implementación en Otro Proyecto

Para replicar esta funcionalidad:

### 1. Crear API Client

```typescript
async function getMarkets() {
  const response = await fetch('https://api.pacifica.fi/api/v1/info');
  const data = await response.json();
  return data.data; // MarketInfo[]
}

async function getPrices() {
  const response = await fetch('https://api.pacifica.fi/api/v1/info/prices');
  const data = await response.json();
  return data.data; // PriceData[]
}
```

### 2. Crear Hooks

```typescript
function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: getMarkets,
    refetchInterval: 60000,
  });
}

function usePrices() {
  return useQuery({
    queryKey: ['prices'],
    queryFn: getPrices,
    refetchInterval: 2000,
  });
}
```

### 3. Combinar en Componente

```typescript
function MarketSelector({ onSelect }) {
  const { data: markets } = useMarkets();
  const { data: prices } = usePrices();

  const enrichedMarkets = useMemo(() => {
    if (!markets || !prices) return [];

    return markets.map(market => {
      const price = prices.find(p => p.symbol === market.symbol);
      return {
        ...market,
        markPrice: parseFloat(price?.mark || '0'),
        change24h: calculateChange(price),
      };
    });
  }, [markets, prices]);

  return (
    <select onChange={(e) => onSelect(enrichedMarkets.find(m => m.symbol === e.target.value))}>
      {enrichedMarkets.map(market => (
        <option key={market.symbol} value={market.symbol}>
          {market.symbol} - ${market.markPrice}
        </option>
      ))}
    </select>
  );
}
```

### 4. WebSocket (Opcional pero Recomendado)

```typescript
const ws = new WebSocket('wss://api.pacifica.fi/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    method: 'subscribe',
    params: { source: 'prices' }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.source === 'prices') {
    queryClient.setQueryData(['prices'], data.data);
  }
};
```
