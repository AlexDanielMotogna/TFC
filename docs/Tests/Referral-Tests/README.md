# Referral System Tests

Scripts para probar el sistema de referidos de 3 niveles.

## Estructura de Referrals

```
74t7...Rveo (T3 earner)
    ↓ refirió a
DxiS...ue5M (T2 earner)
    ↓ refirió a
CM8F...ovWP (T1 earner)
    ↓ refirió a
[TEST_USER] (trader que genera fees)
```

## Commission Rates

| Tier | Porcentaje | Descripción |
|------|------------|-------------|
| T1 | 34% | Referido directo |
| T2 | 12% | Referido de tu referido |
| T3 | 4% | Referido de T2 |
| **Total** | **50%** | Del fee del trade |

## Scripts Disponibles

### 1. `test-referrals.ts` - Test básico T1
Crea trades para un usuario con referrer T1.

```bash
npx tsx docs/Tests/Referral-Tests/test-referrals.ts
```

### 2. `test-referrals-t2.ts` - Test T1 + T2
Crea trades para un usuario con referrers T1 y T2.

```bash
npx tsx docs/Tests/Referral-Tests/test-referrals-t2.ts
```

### 3. `test-referrals-t3.ts` - Test completo T1 + T2 + T3
Crea un usuario de prueba y trades para probar los 3 niveles.

```bash
npx tsx docs/Tests/Referral-Tests/test-referrals-t3.ts
```

### 4. `verify-referral-dashboard.ts` - Verificación
Muestra todos los datos del dashboard de referrals para cada referrer.

```bash
npx tsx docs/Tests/Referral-Tests/verify-referral-dashboard.ts
```

### 5. `cleanup-test-referrals.ts` - Limpieza
Borra todos los trades y earnings de prueba creados hoy.

```bash
npx tsx docs/Tests/Referral-Tests/cleanup-test-referrals.ts
```

## Resultados Esperados

### Después de ejecutar todos los tests:

| Referrer | T1 Earnings | T2 Earnings | T3 Earnings | Total |
|----------|-------------|-------------|-------------|-------|
| **CM8F** | $30.60 | - | - | **$30.60** |
| **DxiS** | $14.62 | $10.80 | - | **$25.42** |
| **74t7** | $9.52 | $5.16 | $3.60 | **$18.28** |

### Trades de prueba creados:

| Test Script | Usuario Trader | Total Fees | Trades |
|-------------|----------------|------------|--------|
| test-referrals.ts | DxiS...ue5M | $28.00 | 5 |
| test-referrals-t2.ts | CM8F...ovWP | $43.00 | 3 |
| test-referrals-t3.ts | TEST_T3_xxx | $90.00 | 3 |
| **Total** | - | **$161.00** | **11** |

## Verificaciones

1. ✅ Commission rates correctos (34%, 12%, 4%)
2. ✅ Cadena T1 → T2 → T3 se crea correctamente
3. ✅ Earnings se acumulan por tier
4. ✅ Claim habilitado cuando unclaimed >= $10
5. ✅ Payout history se registra

## Limpieza

Para borrar todos los datos de prueba:

```bash
# Opción 1: Script automático (borra trades de hoy)
npx tsx docs/Tests/Referral-Tests/cleanup-test-referrals.ts

# Opción 2: SQL manual
DELETE FROM referral_earnings WHERE trade_id IN (SELECT id FROM trades WHERE created_at >= CURRENT_DATE);
DELETE FROM trades WHERE created_at >= CURRENT_DATE;
DELETE FROM referrals WHERE referred_id IN (SELECT id FROM users WHERE handle LIKE 'TEST_%');
DELETE FROM users WHERE handle LIKE 'TEST_%';
```

## Notas

- Los scripts usan Prisma Client directamente
- Los trades tienen `pacificaHistoryId` únicos generados con timestamp
- El usuario TEST_T3_xxx se crea solo en el test de T3
- Los earnings se marcan como `isPaid: false` inicialmente
