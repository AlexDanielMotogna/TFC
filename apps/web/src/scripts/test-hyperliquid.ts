/**
 * Hyperliquid Integration Test Script
 *
 * Tests the HyperliquidAdapter (read-only) and HyperliquidOrderRouter (trading).
 *
 * Usage:
 *   npx tsx apps/web/src/scripts/test-hyperliquid.ts [--testnet] [--trade]
 *
 * Flags:
 *   --testnet    Use Hyperliquid testnet instead of mainnet
 *   --trade      Run trading tests (requires agent wallet in DB)
 *   --account    Specify an account address for account data tests
 */

import * as path from 'path';
import * as fs from 'fs';

// ─── Load environment variables ──────────────────────────────
// Load from multiple .env files (root .env, apps/web/.env, apps/web/.env.local)
function loadEnvFile(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Don't override existing env vars
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore errors loading env files
  }
}

// Find project root (where package.json with "name": "tradefightclub" is)
const scriptDir = __dirname || path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(scriptDir, '../../../../..');
const webRoot = path.resolve(scriptDir, '../..');

loadEnvFile(path.join(webRoot, '.env.local'));
loadEnvFile(path.join(webRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env'));

// ─── Read-only tests (no wallet needed) ───────────────────────

const args = process.argv.slice(2);
const useTestnet = args.includes('--testnet');
const runTrade = args.includes('--trade');
const accountArg = args.find(a => a.startsWith('--account='));
const testAccount = accountArg?.split('=')[1] || '0xc64cc00b46d8E10b1b7024a8085e3fEDd2a4f05e'; // Public HL whale for testing

if (useTestnet) {
  process.env.HYPERLIQUID_API_URL = 'https://api.hyperliquid-testnet.xyz';
  process.env.NEXT_PUBLIC_HYPERLIQUID_API_URL = 'https://api.hyperliquid-testnet.xyz';
}

const HL_API = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';

console.log('═══════════════════════════════════════════════════');
console.log('  Hyperliquid Integration Test');
console.log(`  API: ${HL_API}`);
console.log(`  Account: ${testAccount}`);
console.log('═══════════════════════════════════════════════════\n');

// ─── Direct API tests (no adapter, raw fetch) ─────────────────

async function testRawApi() {
  console.log('━━━ Part 1: Raw API Access ━━━\n');

  // Test 1: metaAndAssetCtxs
  console.log('1. metaAndAssetCtxs...');
  const metaResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  });
  const metaData = await metaResp.json() as [{ universe: Array<{ name: string; szDecimals: number; maxLeverage: number }> }, Array<{ markPx: string; oraclePx: string; funding: string }>];
  const assets = metaData[0].universe;
  const ctxs = metaData[1];
  console.log(`   ✓ ${assets.length} assets loaded`);
  console.log(`   Top 5: ${assets.slice(0, 5).map(a => a.name).join(', ')}`);

  // Show BTC info
  const btcIdx = assets.findIndex(a => a.name === 'BTC');
  if (btcIdx >= 0) {
    const btcCtx = ctxs[btcIdx];
    console.log(`   BTC: mark=${btcCtx.markPx}, oracle=${btcCtx.oraclePx}, funding=${btcCtx.funding}, maxLev=${assets[btcIdx].maxLeverage}x`);
  }

  // Test 2: allMids
  console.log('\n2. allMids...');
  const midsResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const midsData = await midsResp.json() as Record<string, string>;
  const midKeys = Object.keys(midsData);
  console.log(`   ✓ ${midKeys.length} mid prices`);
  console.log(`   BTC: $${midsData['BTC']}, ETH: $${midsData['ETH']}, SOL: $${midsData['SOL']}`);

  // Test 3: l2Book
  console.log('\n3. l2Book (BTC)...');
  const bookResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'l2Book', coin: 'BTC' }),
  });
  const bookData = await bookResp.json() as { levels: [Array<{ px: string; sz: string; n: number }>, Array<{ px: string; sz: string; n: number }>] };
  console.log(`   ✓ Bids: ${bookData.levels[0].length} levels, Asks: ${bookData.levels[1].length} levels`);
  if (bookData.levels[0].length > 0 && bookData.levels[1].length > 0) {
    console.log(`   Best bid: $${bookData.levels[0][0].px} (${bookData.levels[0][0].sz} BTC)`);
    console.log(`   Best ask: $${bookData.levels[1][0].px} (${bookData.levels[1][0].sz} BTC)`);
  }

  // Test 4: candleSnapshot
  console.log('\n4. candleSnapshot (BTC, 1h)...');
  const now = Date.now();
  const candleResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin: 'BTC', interval: '1h', startTime: now - 24 * 60 * 60 * 1000, endTime: now },
    }),
  });
  const candles = await candleResp.json() as Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>;
  console.log(`   ✓ ${candles.length} candles`);
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    console.log(`   Latest: O=${last.o} H=${last.h} L=${last.l} C=${last.c} V=${last.v}`);
  }

  // Test 5: clearinghouseState (account)
  console.log(`\n5. clearinghouseState (${testAccount.slice(0, 10)}...)...`);
  const stateResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: testAccount }),
  });
  const state = await stateResp.json() as {
    assetPositions: Array<{ position: { coin: string; szi: string; entryPx: string | null; unrealizedPnl: string; leverage: { value: number } } }>;
    marginSummary: { accountValue: string; totalMarginUsed: string; totalRawUsd: string };
    withdrawable: string;
  };
  console.log(`   ✓ Account value: $${state.marginSummary.accountValue}`);
  console.log(`   Balance (USDC): $${state.marginSummary.totalRawUsd}`);
  console.log(`   Margin used: $${state.marginSummary.totalMarginUsed}`);
  console.log(`   Withdrawable: $${state.withdrawable}`);

  const openPositions = state.assetPositions.filter(ap => parseFloat(ap.position.szi) !== 0);
  console.log(`   Open positions: ${openPositions.length}`);
  for (const ap of openPositions.slice(0, 5)) {
    const p = ap.position;
    const side = parseFloat(p.szi) > 0 ? 'LONG' : 'SHORT';
    console.log(`     ${p.coin} ${side} ${Math.abs(parseFloat(p.szi))} @ ${p.entryPx} (PnL: $${p.unrealizedPnl}, ${p.leverage.value}x)`);
  }

  // Test 6: openOrders
  console.log(`\n6. openOrders (${testAccount.slice(0, 10)}...)...`);
  const ordersResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'frontendOpenOrders', user: testAccount }),
  });
  const orders = await ordersResp.json() as Array<{ coin: string; oid: number; side: string; limitPx: string; sz: string }>;
  console.log(`   ✓ ${orders.length} open orders`);
  for (const o of orders.slice(0, 5)) {
    console.log(`     ${o.coin} ${o.side === 'B' ? 'BUY' : 'SELL'} ${o.sz} @ $${o.limitPx} (oid: ${o.oid})`);
  }

  // Test 7: userFills
  console.log(`\n7. userFills (${testAccount.slice(0, 10)}...)...`);
  const fillsResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'userFills', user: testAccount }),
  });
  const fills = await fillsResp.json() as Array<{ coin: string; px: string; sz: string; dir: string; time: number; fee: string; closedPnl: string }>;
  console.log(`   ✓ ${fills.length} fills`);
  for (const f of fills.slice(0, 3)) {
    const time = new Date(f.time).toISOString();
    console.log(`     ${f.coin} ${f.dir} ${f.sz} @ $${f.px} (fee: $${f.fee}, pnl: $${f.closedPnl}) ${time}`);
  }

  return { assets: assets.length, btcPrice: midsData['BTC'] };
}

// ─── Adapter tests (using HyperliquidAdapter) ─────────────────

async function testAdapter() {
  console.log('\n\n━━━ Part 2: HyperliquidAdapter (normalized) ━━━\n');

  // Dynamic import to handle module resolution
  const { HyperliquidAdapter } = await import('../lib/server/exchanges/hyperliquid-adapter');
  const adapter = new HyperliquidAdapter();

  // Test getMarkets
  console.log('1. getMarkets()...');
  const markets = await adapter.getMarkets();
  console.log(`   ✓ ${markets.length} markets`);
  const btcMarket = markets.find(m => m.symbol === 'BTC-USD');
  if (btcMarket) {
    console.log(`   BTC-USD: maxLev=${btcMarket.maxLeverage}x, tickSize=${btcMarket.tickSize}, stepSize=${btcMarket.stepSize}, fundingRate=${btcMarket.fundingRate}`);
  }

  // Test getPrices
  console.log('\n2. getPrices()...');
  const prices = await adapter.getPrices();
  console.log(`   ✓ ${prices.length} prices`);
  const btcPrice = prices.find(p => p.symbol === 'BTC-USD');
  if (btcPrice) {
    console.log(`   BTC-USD: mark=$${btcPrice.mark}, index=$${btcPrice.index}, 24h=${btcPrice.change24h}%, vol=$${btcPrice.volume24h}`);
  }

  // Test getOrderbook
  console.log('\n3. getOrderbook("BTC-USD")...');
  const orderbook = await adapter.getOrderbook('BTC-USD');
  console.log(`   ✓ Bids: ${orderbook.bids.length}, Asks: ${orderbook.asks.length}`);
  if (orderbook.bids.length > 0) {
    console.log(`   Best bid: $${orderbook.bids[0][0]} x ${orderbook.bids[0][1]}`);
    console.log(`   Best ask: $${orderbook.asks[0][0]} x ${orderbook.asks[0][1]}`);
  }

  // Test getKlines
  console.log('\n4. getKlines("BTC-USD", "1h")...');
  const klines = await adapter.getKlines({
    symbol: 'BTC-USD',
    interval: '1h',
    startTime: Date.now() - 12 * 60 * 60 * 1000,
    limit: 5,
  });
  console.log(`   ✓ ${klines.length} candles`);
  if (klines.length > 0) {
    const last = klines[klines.length - 1];
    console.log(`   Latest: O=${last.open} H=${last.high} L=${last.low} C=${last.close}`);
  }

  // Test getAccount
  console.log(`\n5. getAccount("${testAccount.slice(0, 10)}...")...`);
  const account = await adapter.getAccount(testAccount);
  console.log(`   ✓ Balance: $${account.balance}`);
  console.log(`   Equity: $${account.accountEquity}`);
  console.log(`   Available: $${account.availableToSpend}`);
  console.log(`   Margin used: $${account.marginUsed}`);
  console.log(`   Unrealized PnL: $${account.unrealizedPnl}`);

  // Test getPositions
  console.log(`\n6. getPositions("${testAccount.slice(0, 10)}...")...`);
  const positions = await adapter.getPositions(testAccount);
  console.log(`   ✓ ${positions.length} open positions`);
  for (const p of positions.slice(0, 5)) {
    console.log(`     ${p.symbol} ${p.side} ${p.amount} @ $${p.entryPrice} (PnL: $${p.unrealizedPnl}, ${p.leverage}x, liq: $${p.liquidationPrice})`);
  }

  // Test getOpenOrders
  console.log(`\n7. getOpenOrders("${testAccount.slice(0, 10)}...")...`);
  const openOrders = await adapter.getOpenOrders(testAccount);
  console.log(`   ✓ ${openOrders.length} open orders`);
  for (const o of openOrders.slice(0, 5)) {
    console.log(`     ${o.symbol} ${o.side} ${o.type} ${o.amount} @ $${o.price} (oid: ${o.orderId})`);
  }

  // Test getTradeHistory
  console.log(`\n8. getTradeHistory("${testAccount.slice(0, 10)}...")...`);
  const trades = await adapter.getTradeHistory({ accountId: testAccount, limit: 5 });
  console.log(`   ✓ ${trades.length} trades`);
  for (const t of trades.slice(0, 3)) {
    const time = new Date(t.executedAt).toISOString();
    console.log(`     ${t.symbol} ${t.side} ${t.amount} @ $${t.price} (fee: $${t.fee}, pnl: ${t.pnl || 'N/A'}) ${time}`);
  }

  // Test getAccountSettings
  console.log(`\n9. getAccountSettings("${testAccount.slice(0, 10)}...")...`);
  const settings = await adapter.getAccountSettings(testAccount);
  console.log(`   ✓ ${settings.length} position settings`);
  for (const s of settings.slice(0, 5)) {
    console.log(`     ${s.symbol}: ${s.leverage}x leverage`);
  }

  console.log('\n✓ All adapter read-only tests passed!');
}

// ─── ExchangeProvider test ────────────────────────────────────

async function testProvider() {
  console.log('\n\n━━━ Part 3: ExchangeProvider Factory ━━━\n');

  const { ExchangeProvider } = await import('../lib/server/exchanges/provider');
  ExchangeProvider.clearCache();

  console.log('1. ExchangeProvider.getAdapter("hyperliquid")...');
  const adapter = ExchangeProvider.getAdapter('hyperliquid');
  console.log(`   ✓ Adapter created: ${adapter.name} ${adapter.version}`);

  console.log('\n2. adapter.getMarkets() via provider...');
  const markets = await adapter.getMarkets();
  console.log(`   ✓ ${markets.length} markets loaded through provider`);

  console.log('\n✓ Provider factory test passed!');
}

// ─── Order Router test (signing, requires agent wallet) ───────

async function testOrderRouter() {
  console.log('\n\n━━━ Part 4: HyperliquidOrderRouter (TRADING) ━━━\n');

  if (!process.env.EXCHANGE_KEY_ENCRYPTION_SECRET) {
    console.log('   ⚠ EXCHANGE_KEY_ENCRYPTION_SECRET not set. Skipping trading tests.');
    console.log('   To set up:');
    console.log('   1. Generate key: openssl rand -hex 32');
    console.log('   2. Add to .env.local: EXCHANGE_KEY_ENCRYPTION_SECRET=<key>');
    console.log('   3. Create ExchangeConnection in DB with encrypted agent wallet');
    return;
  }

  const { getOrderRouter } = await import('../lib/server/exchanges/order-router');
  const router = getOrderRouter('hyperliquid');

  console.log(`   Router: ${router.exchangeType}, signsServerSide=${router.signsServerSide}`);

  // Only run actual trading on testnet
  if (!useTestnet) {
    console.log('   ⚠ Trading tests require --testnet flag for safety. Skipping.');
    return;
  }

  console.log('\n   Testing setLeverage (BTC-USD, 5x)...');
  const levResult = await router.setLeverage({
    account: testAccount,
    symbol: 'BTC-USD',
    leverage: 5,
  });
  console.log(`   Result: ${JSON.stringify(levResult)}`);

  // ─── Margin mode tests ──────────────────────────────────────
  console.log('\n   Testing setMargin — switch to Isolated...');
  const isolatedResult = await router.setMargin({
    account: testAccount,
    symbol: 'BTC-USD',
    is_isolated: true,
  });
  console.log(`   Result: ${JSON.stringify(isolatedResult)}`);

  console.log('\n   Testing setMargin — switch back to Cross...');
  const crossResult = await router.setMargin({
    account: testAccount,
    symbol: 'BTC-USD',
    is_isolated: false,
  });
  console.log(`   Result: ${JSON.stringify(crossResult)}`);

  // Fetch current BTC price to set a safe limit price (within 80% of reference)
  const midResp = await fetch(`${HL_API}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const mids = await midResp.json() as Record<string, string>;
  const btcMid = parseFloat(mids['BTC'] || '65000');
  const testPrice = Math.round(btcMid * 0.5); // 50% of current — within 80% limit

  console.log(`\n   Testing createOrder (BTC-USD limit buy @ $${testPrice}, ~50% below $${btcMid})...`);
  const orderResult = await router.createOrder({
    account: testAccount,
    symbol: 'BTC-USD',
    side: 'BUY',
    type: 'LIMIT',
    amount: '0.001',
    price: testPrice.toString(),
  });
  console.log(`   Result: ${JSON.stringify(orderResult)}`);

  if (orderResult.success && orderResult.data) {
    // Try to cancel it
    const statuses = (orderResult.data as { type: string; data: { statuses: Array<{ resting: { oid: number } }> } })?.data?.statuses;
    if (statuses?.[0]?.resting?.oid) {
      const oid = statuses[0].resting.oid;
      console.log(`\n   Testing cancelOrder (oid: ${oid})...`);
      const cancelResult = await router.cancelOrder({
        account: testAccount,
        order_id: oid.toString(),
        symbol: 'BTC-USD',
      });
      console.log(`   Result: ${JSON.stringify(cancelResult)}`);
    }
  }

  // ─── Stop Market order test ────────────────────────────────
  // Buy stop: trigger ABOVE current price (breakout entry)
  const stopTriggerBuy = Math.round(btcMid * 1.10); // 10% above market
  console.log(`\n   Testing createStopOrder — Stop Market BUY (trigger @ $${stopTriggerBuy}, ~10% above $${btcMid})...`);
  const stopMarketResult = await router.createStopOrder({
    account: testAccount,
    symbol: 'BTC-USD',
    side: 'BUY',
    reduce_only: false,
    stop_order: {
      stop_price: stopTriggerBuy.toString(),
      amount: '0.001',
    },
  });
  console.log(`   Result: ${JSON.stringify(stopMarketResult)}`);

  // Sell stop: trigger BELOW current price (breakdown entry)
  const stopTriggerSell = Math.round(btcMid * 0.90); // 10% below market
  console.log(`\n   Testing createStopOrder — Stop Market SELL (trigger @ $${stopTriggerSell}, ~10% below $${btcMid})...`);
  const stopMarketSellResult = await router.createStopOrder({
    account: testAccount,
    symbol: 'BTC-USD',
    side: 'SELL',
    reduce_only: false,
    stop_order: {
      stop_price: stopTriggerSell.toString(),
      amount: '0.001',
    },
  });
  console.log(`   Result: ${JSON.stringify(stopMarketSellResult)}`);

  // ─── Stop Limit order test ───────────────────────────────
  const stopLimitTrigger = Math.round(btcMid * 1.08); // 8% above market
  const stopLimitPrice = Math.round(btcMid * 1.09);   // limit slightly above trigger
  console.log(`\n   Testing createStopOrder — Stop Limit BUY (trigger @ $${stopLimitTrigger}, limit @ $${stopLimitPrice})...`);
  const stopLimitResult = await router.createStopOrder({
    account: testAccount,
    symbol: 'BTC-USD',
    side: 'BUY',
    reduce_only: false,
    stop_order: {
      stop_price: stopLimitTrigger.toString(),
      amount: '0.001',
      limit_price: stopLimitPrice.toString(),
    },
  });
  console.log(`   Result: ${JSON.stringify(stopLimitResult)}`);

  // Clean up: cancel all remaining open orders
  console.log('\n   Cleaning up: cancelAllOrders (BTC-USD)...');
  const cancelAllResult = await router.cancelAllOrders({
    account: testAccount,
    symbol: 'BTC-USD',
  });
  console.log(`   Result: ${JSON.stringify(cancelAllResult)}`);

  console.log('\n✓ All trading tests passed!');
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  try {
    const rawResult = await testRawApi();
    await testAdapter();
    await testProvider();

    if (runTrade) {
      await testOrderRouter();
    } else {
      console.log('\n\n━━━ Trading tests skipped (add --trade flag to enable) ━━━');
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  All tests completed!');
    console.log(`  ${rawResult.assets} assets, BTC @ $${rawResult.btcPrice}`);
    console.log('═══════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

main();
