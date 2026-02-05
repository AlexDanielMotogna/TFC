# Exchange Adapter - Quick Start Guide

## ✅ Phase 1: Foundation - COMPLETED

The Exchange Adapter architecture has been successfully implemented!

### What's Been Built

1. **Universal Adapter Interface** (`adapter.ts`)
   - Normalized types for all exchanges
   - Exchange-agnostic API

2. **Pacifica Adapter** (`pacifica-adapter.ts`)
   - Wraps existing Pacifica client
   - Symbol/side normalization

3. **Cached Adapter** (`cached-adapter.ts`)
   - Redis caching with TTLs
   - Request deduplication
   - Automatic cache invalidation

4. **Provider Factory** (`provider.ts`)
   - Singleton pattern
   - Auto-wraps with caching when Redis configured

5. **Account Service Migration**
   - Now uses Exchange Adapter
   - Feature flag controlled

---

## 🚀 Setup Instructions

### 1. Configure Redis (Optional - Enables Caching)

**Option A: Local Redis**
```bash
# Install Redis locally
# Windows: https://github.com/microsoftarchive/redis/releases
# Mac: brew install redis

# Start Redis
redis-server

# Add to .env
REDIS_URL=redis://localhost:6379
```

**Option B: Upstash (Free Tier)**
```bash
# 1. Sign up at https://upstash.com
# 2. Create Redis database
# 3. Copy connection URL

# Add to .env
REDIS_URL=redis://default:your_password@your-endpoint.upstash.io:6379
```

**Option C: Skip Redis (No Caching)**
```bash
# Leave REDIS_URL unset
# Adapter will work without caching (direct API calls)
```

### 2. Configure Feature Flag (Optional)

```bash
# .env
USE_EXCHANGE_ADAPTER=true  # Default: uses adapter
# USE_EXCHANGE_ADAPTER=false  # Fallback: direct Pacifica calls
```

### 3. Test the Implementation

Start your dev server and test the account summary endpoint:

```bash
npm run dev

# The account service now uses the Exchange Adapter
# Check logs for [CachedAdapter] messages if Redis is configured
```

---

## 📊 Expected Performance

### With Redis Caching

| Metric | Before | After |
|--------|--------|-------|
| Account API calls | Every request | Cached 5s |
| Response time | 500ms | 10ms (50× faster) |
| Concurrent requests | 100 calls | 1 call + 99 cache hits |
| Cache hit rate | 0% | >95% |

### Cache TTLs

- **Markets**: 5 minutes (static data)
- **Prices**: 5 seconds (real-time)
- **Account/Positions**: 5 seconds
- **Orders**: 3 seconds (most volatile)
- **Trade History**: 10 seconds

---

## 🔍 Monitoring

### Check if Redis is Connected

Look for log messages:
- `[CachedAdapter] Redis cache read failed:` - Redis connection issue
- No errors = Redis working correctly

### Check Cache Effectiveness

```bash
# Connect to Redis CLI
redis-cli

# Check keys being cached
KEYS pacifica:*

# Get cache value
GET pacifica:account:YOUR_ACCOUNT_ADDRESS

# Monitor cache operations in real-time
MONITOR
```

---

## 🐛 Troubleshooting

### Problem: Redis Connection Failed

**Solution**: Check `REDIS_URL` environment variable
- Adapter will gracefully fallback to direct API calls
- No downtime, just no caching

### Problem: Stale Data

**Solution**: Cache TTLs are conservative (3-5 seconds)
- Trading operations automatically invalidate cache
- Manual flush: `redis-cli FLUSHDB`

### Problem: Want to Disable Adapter

**Solution**: Set environment variable
```bash
USE_EXCHANGE_ADAPTER=false
```

---

## 📈 Next Steps

### Phase 2: Migrate More Routes

Migrate these API routes to use the adapter:

1. `/api/markets/route.ts` - Market data
2. `/api/markets/prices/route.ts` - Prices
3. `/api/account/positions/route.ts` - Positions
4. `/api/account/orders/open/route.ts` - Open orders
5. `/api/orders/route.ts` - Trading operations

### Pattern for Migration

**Before**:
```typescript
import * as Pacifica from '@/lib/server/pacifica';

const data = await Pacifica.getPositions(accountAddress);
```

**After**:
```typescript
import { ExchangeProvider } from '@/lib/server/exchanges/provider';

const adapter = await ExchangeProvider.getUserAdapter(userId);
const data = await adapter.getPositions(accountAddress);
```

---

## 📚 Documentation

- [Architecture Overview](../../../../../docs/Adapters/README.md)
- [Migration Plan](../../../../../docs/Adapters/exchange-adapter-migration-plan.md)
- [API Analysis](../../../../../docs/Api/pacifica-api-consumation.md)

---

## 🎯 Performance Targets

| Users | Without Cache | With Cache | Reduction |
|-------|---------------|------------|-----------|
| 5,000 | 200-300 req/s | 30-40 req/s | 85% |
| 10,000 | 400-600 req/s | 40-60 req/s | 90% |

**Ready to scale to thousands of users!** 🚀
