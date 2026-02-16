'use client';

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth, useAccount, usePrices, useCreateMarketOrder, useCreateLimitOrder, useCancelOrder, useCancelStopOrder, useCancelAllOrders, useSetPositionTpSl, useCreateStopOrder, useCreateStandaloneStopOrder, useSetLeverage, useSetMarginMode, useAccountSettings, useTradeHistory, useOrderHistory, useBuilderCodeStatus, useApproveBuilderCode, useFight, useStakeInfo, useFightPositions, useFightTrades, useFightOrders, useFightOrderHistory, usePacificaWsStore } from '@/hooks';
// Note: isAuthenticating and user from useAuth are used by AppShell now
import { TradingViewChartAdvanced } from '@/components/TradingViewChartAdvanced';
import { OrderBook } from '@/components/OrderBook';
import { Positions, type Position, type LimitCloseParams, type MarketCloseParams, type TpSlParams } from '@/components/Positions';
import { FightBanner } from '@/components/FightBanner';
import { ActiveFightsSwitcher } from '@/components/ActiveFightsSwitcher';
import { AppShell } from '@/components/AppShell';
import { CloseOppositeModal } from '@/components/CloseOppositeModal';
import { MarketSelector } from '@/components/MarketSelector';
import { Toggle } from '@/components/Toggle';
import { WithdrawModal } from '@/components/WithdrawModal';
import { EditOrderModal } from '@/components/EditOrderModal';
import { BetaGate } from '@/components/BetaGate';
import { formatPrice, formatUSD, formatPercent, formatFundingRate } from '@/lib/formatters';
import { toast } from 'sonner';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';

// Default market shown while loading from API
const DEFAULT_MARKET = { symbol: 'BTC-USD', name: 'Bitcoin', maxLeverage: 50 };

const PACIFICA_DEPOSIT_URL = 'https://app.pacifica.fi?referral=TFC';

// TradeFightClub platform fee (fixed)
const TRADECLUB_FEE = 0.0005; // 0.05% builder fee

// NOTE: Pacifica fees (maker_fee, taker_fee) are now fetched dynamically from the API
// They change monthly, so we no longer use hardcoded fee tiers

function TradePageContent() {
  const { connected } = useWallet();
  const { isAuthenticated, pacificaConnected, pacificaFailReason } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial symbol from URL (e.g., /trade?symbol=ETH-USD)
  const urlSymbol = searchParams?.get('symbol');
  const {
    account,
    positions: apiPositions,
    openOrders,
    refetch: refetchAccount,
  } = useAccount();

  // Trading hooks
  const createMarketOrder = useCreateMarketOrder();
  const createLimitOrder = useCreateLimitOrder();
  const cancelOrder = useCancelOrder();
  const cancelStopOrder = useCancelStopOrder();
  const cancelAllOrders = useCancelAllOrders();
  const setPositionTpSl = useSetPositionTpSl();
  const createStopOrder = useCreateStopOrder();
  const createStandaloneStopOrder = useCreateStandaloneStopOrder();
  const setLeverageMutation = useSetLeverage();
  const setMarginModeMutation = useSetMarginMode();

  // Account settings (for leverage per symbol)
  const { data: accountSettings } = useAccountSettings();

  // History hooks (with pagination)
  const {
    data: tradeHistory = [],
    hasNextPage: hasMoreTrades,
    fetchNextPage: fetchMoreTrades,
    isFetchingNextPage: isLoadingMoreTrades,
  } = useTradeHistory();
  const { data: orderHistoryData = [] } = useOrderHistory();

  // Builder code approval (required for trading)
  const { data: builderCodeStatus, isLoading: isLoadingBuilderCode } = useBuilderCodeStatus();
  const approveBuilderCode = useApproveBuilderCode();

  // Fight state (for max size validation)
  const { isActive: inActiveFight, maxSize: fightMaxSize, fightId } = useFight();

  // Stake limit info (available capital in fight)
  // maxExposureUsed = highest exposure ever reached (never resets when closing positions)
  // available = stake - maxExposureUsed (once capital is used, it can't be reused)
  const { inFight, stake, currentExposure, maxExposureUsed, available: availableStake, blockedSymbols } = useStakeInfo();

  // Fight-specific data hooks
  const { positions: fightPositions } = useFightPositions(fightId);
  const { trades: fightTrades } = useFightTrades(fightId);
  const { orders: fightOpenOrders } = useFightOrders(fightId);
  const { orderHistory: fightOrderHistory } = useFightOrderHistory(fightId);

  // Pacifica WebSocket connection status (for real-time updates)
  const pacificaWsConnected = usePacificaWsStore((state) => state.isConnected);

  // Trading terminal state - initialize from URL if present
  const [selectedMarket, setSelectedMarket] = useState(() => urlSymbol || 'BTC-USD');

  // Check if currently selected symbol is blocked (pre-fight position exists)
  const isSymbolBlocked = useMemo(() => {
    return inFight && blockedSymbols.includes(selectedMarket);
  }, [inFight, blockedSymbols, selectedMarket]);

  // Update URL when market changes (shallow navigation)
  // Preserve fight parameter if user is in an active fight
  const handleMarketChange = useCallback((symbol: string) => {
    setSelectedMarket(symbol);
    // Preserve fight parameter if exists
    const currentFightId = searchParams?.get('fight');
    const url = currentFightId
      ? `/trade?fight=${currentFightId}&symbol=${symbol}`
      : `/trade?symbol=${symbol}`;
    router.replace(url, { scroll: false });
  }, [router, searchParams]);

  // Set page title with current asset
  useEffect(() => {
    const asset = selectedMarket.split('-')[0];
    document.title = `${asset} - Trade - Trading Fight Club`;
  }, [selectedMarket]);

  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderSize, setOrderSize] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [savedLeverage, setSavedLeverage] = useState(5); // Track server-saved leverage
  const [isIsolated, setIsIsolated] = useState(false); // Cross (false) or Isolated (true)

  // Order type state
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-market' | 'stop-limit'>('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');

  // TP/SL state
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [reduceOnly, setReduceOnly] = useState(false);

  // Margin mode confirmation modal state
  const [showMarginModeModal, setShowMarginModeModal] = useState(false);
  const [pendingMarginMode, setPendingMarginMode] = useState<boolean | null>(null); // null = no pending change

  // Close opposite position modal state
  const [showCloseOppositeModal, setShowCloseOppositeModal] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    symbol: string;
    side: 'LONG' | 'SHORT';
    amount: string;
    positionValue: number;
    oppositePosition: Position | null;
  } | null>(null);

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Edit order modal state
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<{
    id: number;
    symbol: string;
    side: string;
    price: string;
    size: string;
    type: string;
  } | null>(null);

  // Close all positions state
  const [isClosingAllPositions, setIsClosingAllPositions] = useState(false);

  // Slippage state
  const [slippage, setSlippage] = useState('0.5');
  const [showSlippageModal, setShowSlippageModal] = useState(false);
  const [showAccountStats, setShowAccountStats] = useState(false);
  const [showMarketInfo, setShowMarketInfo] = useState(false);
  const [slippageInput, setSlippageInput] = useState('0.5');

  // Mobile CEX-style layout state (only used < xl)
  const [mobileSection, setMobileSection] = useState<'chart' | 'orderbook' | 'info'>('chart');
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [orderSheetVisible, setOrderSheetVisible] = useState(false);

  // Open: mount → next frame set visible (triggers transition in)
  // Close: set invisible → wait for transition → unmount
  useEffect(() => {
    if (showOrderSheet) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOrderSheetVisible(true));
      });
    }
  }, [showOrderSheet]);

  const closeOrderSheet = useCallback(() => {
    setOrderSheetVisible(false);
    setTimeout(() => {
      setShowOrderSheet(false);
    }, 500);
  }, []);

  // Bottom tabs - with URL persistence
  type BottomTab = 'positions' | 'orders' | 'trades' | 'history';
  const VALID_BOTTOM_TABS: BottomTab[] = ['positions', 'orders', 'trades', 'history'];

  const getBottomTabFromUrl = useCallback((): BottomTab => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && VALID_BOTTOM_TABS.includes(tabParam as BottomTab)) {
      return tabParam as BottomTab;
    }
    return 'positions';
  }, [searchParams]);

  const [bottomTab, setBottomTabState] = useState<BottomTab>(getBottomTabFromUrl);

  const setBottomTab = useCallback((tab: BottomTab) => {
    setBottomTabState(tab);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (tab === 'positions') {
      params.delete('tab'); // Default tab, no need to show in URL
    } else {
      params.set('tab', tab);
    }
    const newUrl = params.toString() ? `/trade?${params.toString()}` : '/trade';
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams]);

  // Sync bottom tab state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromUrl = getBottomTabFromUrl();
    if (tabFromUrl !== bottomTab) {
      setBottomTabState(tabFromUrl);
    }
  }, [searchParams, getBottomTabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort state for tables: { column, desc }
  const [ordersSort, setOrdersSort] = useState<{ col: string; desc: boolean }>({ col: 'time', desc: true });
  const [tradesSort, setTradesSort] = useState<{ col: string; desc: boolean }>({ col: 'time', desc: true });
  const [orderHistorySort, setOrderHistorySort] = useState<{ col: string; desc: boolean }>({ col: 'time', desc: true });

  // Helper to toggle sort column
  const toggleSort = (
    current: { col: string; desc: boolean },
    setter: (val: { col: string; desc: boolean }) => void,
    column: string
  ) => {
    if (current.col === column) {
      setter({ col: column, desc: !current.desc });
    } else {
      setter({ col: column, desc: true });
    }
  };

  // Fight filter toggle (only visible when in active fight)
  const [showFightOnly, setShowFightOnly] = useState(true);
  // Fight capital limit accordion (collapsed by default)
  const [showFightCapital, setShowFightCapital] = useState(true);

  // Markets and prices from Pacifica API (dynamic, not hardcoded)
  const { markets, getPrice } = usePrices({
  });

  // Auto-select first non-blocked symbol when in a fight and current symbol is blocked
  useEffect(() => {
    if (!inFight || !blockedSymbols.length || markets.length === 0) return;

    // If current symbol is blocked, find first non-blocked symbol
    if (blockedSymbols.includes(selectedMarket)) {
      const firstNonBlocked = markets.find((m: { symbol: string }) => !blockedSymbols.includes(m.symbol));
      if (firstNonBlocked) {
        console.log(`[Trade] Auto-switching from blocked ${selectedMarket} to ${firstNonBlocked.symbol}`);
        handleMarketChange(firstNonBlocked.symbol);
      }
    }
  }, [inFight, blockedSymbols, markets, selectedMarket, handleMarketChange]);

  const currentPriceData = getPrice(selectedMarket);
  // Use oracle price as the main price (closer to last traded price than mark price)
  const currentPrice = currentPriceData?.oracle || currentPriceData?.price || 0;
  const markPrice = currentPriceData?.price || currentPrice;
  const priceChange = currentPriceData?.change24h || 0;
  const volume24h = currentPriceData?.volume24h || 0;
  const openInterest = currentPriceData?.openInterest || 0;
  const fundingRate = currentPriceData?.funding || 0;
  const nextFundingRate = currentPriceData?.nextFunding || 0;
  const maxLeverage = currentPriceData?.maxLeverage || 10;
  const tickSize = currentPriceData?.tickSize || 0.01;
  const lotSize = currentPriceData?.lotSize || 0.00001;

  // Helper to round amount to lot size
  const roundToLotSize = (amount: number, lotSize: number): string => {
    const precision = Math.max(0, -Math.floor(Math.log10(lotSize)));
    const rounded = Math.floor(amount / lotSize) * lotSize;
    return rounded.toFixed(precision);
  };

  // Helper to round price to tick size (Pacifica requires prices to be multiples of tick size)
  const roundToTickSize = useCallback((price: number): string => {
    const rounded = Math.round(price / tickSize) * tickSize;
    const decimals = tickSize >= 1 ? 0 : Math.ceil(-Math.log10(tickSize));
    return rounded.toFixed(decimals);
  }, [tickSize]);

  // Check if leverage can be set (validates against open positions)
  const canSetLeverage = useCallback((lev: number): { valid: boolean; error?: string } => {
    const marketSymbol = selectedMarket.replace('-USD', '');
    const openPosition = apiPositions?.find(
      (p: any) => p.symbol.replace('-USD', '') === marketSymbol
    );

    if (openPosition) {
      const positionLeverage = openPosition.leverage || 1;
      // Pacifica only allows INCREASING leverage on open positions
      if (lev < positionLeverage) {
        return {
          valid: false,
          error: `Cannot decrease leverage below ${positionLeverage}x while ${marketSymbol} position is open`
        };
      }
    }
    return { valid: true };
  }, [selectedMarket, apiPositions]);

  // Handle Set Leverage button click
  const handleSetLeverage = useCallback(() => {
    const check = canSetLeverage(leverage);
    if (!check.valid) {
      toast.error(check.error);
      return;
    }
    setLeverageMutation.mutate(
      { symbol: selectedMarket, leverage },
      {
        onSuccess: () => {
          setSavedLeverage(leverage); // Update saved leverage on success
        }
      }
    );
  }, [leverage, selectedMarket, canSetLeverage, setLeverageMutation]);

  // Handle margin mode change (cross/isolated) — opens confirmation modal
  const handleSetMarginMode = useCallback((isolated: boolean) => {
    if (isolated === isIsolated) return;
    setPendingMarginMode(isolated);
    setShowMarginModeModal(true);
  }, [isIsolated]);

  // Confirm margin mode change from modal
  const confirmMarginMode = useCallback(() => {
    const newMode = pendingMarginMode ?? isIsolated;
    if (newMode === isIsolated) {
      // No change — just close
      setShowMarginModeModal(false);
      setPendingMarginMode(null);
      return;
    }
    setMarginModeMutation.mutate(
      { symbol: selectedMarket, isIsolated: newMode },
      {
        onSuccess: () => {
          setIsIsolated(newMode);
          setShowMarginModeModal(false);
          setPendingMarginMode(null);
        }
      }
    );
  }, [pendingMarginMode, isIsolated, selectedMarket, setMarginModeMutation]);

  // Check if current market has an open position (blocks margin mode change)
  const hasOpenPosition = useMemo(() => {
    const marketSymbol = selectedMarket.replace('-USD', '');
    return apiPositions.some(
      (pos: any) => (pos.symbol || '').replace('-USD', '') === marketSymbol
    );
  }, [selectedMarket, apiPositions]);

  // Initialize leverage from account settings when market changes
  useEffect(() => {
    if (accountSettings && Array.isArray(accountSettings)) {
      const marketSymbol = selectedMarket.replace('-USD', '');
      const setting = accountSettings.find((s: any) => s.symbol === marketSymbol);
      if (setting?.leverage) {
        setLeverage(setting.leverage);
        setSavedLeverage(setting.leverage);
      } else {
        // Default to max leverage if no setting saved
        setLeverage(maxLeverage);
        setSavedLeverage(maxLeverage);
      }
      // Load margin mode from settings
      setIsIsolated(setting?.isolated ?? false);
    }
  }, [selectedMarket, accountSettings, maxLeverage]);

  // Execute order (called directly or after modal confirmation)
  const executeOrder = useCallback(async () => {
    const effectiveLeverage = Math.min(leverage, maxLeverage);
    const effectivePositionSize = parseFloat(orderSize) * effectiveLeverage;

    try {
      // Calculate amount in tokens (position size with leverage, divided by price)
      // Round down to lot size to avoid Pacifica API rejection
      // For limit orders, use limit price; for market, use current price
      const priceForCalc = orderType === 'limit' || orderType === 'stop-limit'
        ? parseFloat(limitPrice) || currentPrice
        : currentPrice;
      const rawAmount = effectivePositionSize / priceForCalc;
      const orderAmount = roundToLotSize(rawAmount, lotSize);

      // Build TP/SL params if enabled (for market and limit orders)
      // Round to tick size to avoid "Invalid stop tick" errors from Pacifica
      const tpParam = (orderType === 'market' || orderType === 'limit') && tpEnabled && takeProfit
        ? { stop_price: roundToTickSize(parseFloat(takeProfit)) }
        : undefined;
      const slParam = (orderType === 'market' || orderType === 'limit') && slEnabled && stopLoss
        ? { stop_price: roundToTickSize(parseFloat(stopLoss)) }
        : undefined;

      // Minimum order size: $11 (Pacifica minimum)
      // Use effectivePositionSize (margin × leverage) which matches the USD display in the UI
      if (effectivePositionSize < 11) {
        toast.error(`Minimum order size is $11 (current: $${effectivePositionSize.toFixed(2)})`);
        return;
      }

      const symbol = selectedMarket.replace('-USD', ''); // Convert BTC-USD to BTC
      const side = selectedSide === 'LONG' ? 'bid' : 'ask';

      if (orderType === 'market') {
        // Market order
        await createMarketOrder.mutateAsync({
          symbol,
          side,
          amount: orderAmount,
          reduceOnly,
          slippage_percent: slippage,
          take_profit: tpParam,
          stop_loss: slParam,
          fightId: fightId || undefined,
          leverage,
        });
      } else if (orderType === 'limit') {
        // Limit order
        if (!limitPrice) {
          toast.error('Please enter a limit price');
          return;
        }
        await createLimitOrder.mutateAsync({
          symbol,
          side,
          price: limitPrice,
          amount: orderAmount,
          reduceOnly,
          tif: 'GTC',
          take_profit: tpParam,
          stop_loss: slParam,
          fightId: fightId || undefined,
          leverage,
        });
      } else if (orderType === 'stop-market' || orderType === 'stop-limit') {
        // Stop orders
        if (!triggerPrice || parseFloat(triggerPrice) <= 0) {
          toast.error('Please enter a trigger price');
          return;
        }
        if (orderType === 'stop-limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
          toast.error('Please enter a limit price for stop-limit orders');
          return;
        }

        // Validate stop order direction:
        // Buy stop (bid/LONG): trigger must be ABOVE current price (breakout entry)
        // Sell stop (ask/SHORT): trigger must be BELOW current price (breakdown entry)
        const trigger = parseFloat(triggerPrice);
        if (side === 'bid' && trigger <= currentPrice) {
          toast.error(`Buy stop trigger must be above current price ($${currentPrice.toFixed(2)}). Use a limit order to buy below market.`);
          return;
        }
        if (side === 'ask' && trigger >= currentPrice) {
          toast.error(`Sell stop trigger must be below current price ($${currentPrice.toFixed(2)}). Use a limit order to sell above market.`);
          return;
        }

        await createStandaloneStopOrder.mutateAsync({
          symbol: selectedMarket,
          side,
          stopPrice: roundToTickSize(parseFloat(triggerPrice)),
          amount: orderAmount,
          limitPrice: orderType === 'stop-limit' ? roundToTickSize(parseFloat(limitPrice)) : undefined,
          reduceOnly,
          fightId: fightId || undefined,
          leverage,
        });
      }

      // Clear order form after successful order
      setOrderSize('');
      setLimitPrice('');
      setTriggerPrice('');
      setTakeProfit('');
      setStopLoss('');
      setTpEnabled(false);
      setSlEnabled(false);
      setShowCloseOppositeModal(false);
      setPendingOrder(null);
    } catch (err) {
      // Error notification is handled by the hook's onError handler
      console.error('Failed to place order:', err instanceof Error ? err.message : err);
    }
  }, [selectedMarket, selectedSide, orderSize, currentPrice, leverage, maxLeverage, createMarketOrder, createLimitOrder, createStandaloneStopOrder, orderType, limitPrice, triggerPrice, tpEnabled, slEnabled, takeProfit, stopLoss, fightId, lotSize, slippage, roundToTickSize, reduceOnly]);

  const handlePlaceOrder = useCallback(async () => {
    if (!isAuthenticated) {
      alert('Please connect wallet to trade');
      return;
    }

    if (!pacificaConnected) {
      alert('Please connect your Pacifica account first');
      return;
    }

    const effectiveLeverage = Math.min(leverage, maxLeverage);

    // Validate max size if in active fight
    const effectivePositionSize = parseFloat(orderSize) * effectiveLeverage;
    if (inActiveFight && fightMaxSize > 0 && effectivePositionSize > fightMaxSize) {
      toast.error(`Position size ($${effectivePositionSize.toLocaleString()}) exceeds fight max size ($${fightMaxSize.toLocaleString()})`);
      return;
    }

    // Check for opposite position in current positions from API
    const oppositeApiPosition = apiPositions.find(
      (pos) => pos.symbol === selectedMarket && pos.side !== selectedSide
    );

    if (oppositeApiPosition) {
      // Calculate position value for modal display
      const oppEntryPrice = parseFloat(oppositeApiPosition.entryPrice) || 0;
      const oppSizeInToken = parseFloat(oppositeApiPosition.size) || 0;
      const oppPositionValue = oppSizeInToken * oppEntryPrice;

      // Show confirmation modal
      const rawAmount = effectivePositionSize / currentPrice;
      const orderAmount = roundToLotSize(rawAmount, lotSize);

      setPendingOrder({
        symbol: selectedMarket,
        side: selectedSide,
        amount: orderAmount,
        positionValue: effectivePositionSize,
        oppositePosition: {
          id: `${oppositeApiPosition.symbol}-${oppositeApiPosition.side}`,
          symbol: oppositeApiPosition.symbol,
          side: oppositeApiPosition.side as 'LONG' | 'SHORT',
          size: oppPositionValue,
          sizeInToken: oppSizeInToken,
          entryPrice: oppEntryPrice,
          markPrice: oppEntryPrice,
          leverage: parseInt(String(oppositeApiPosition.leverage)) || 1,
          liquidationPrice: 0,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          margin: 0,
          marginType: 'Cross' as const,
          funding: 0,
        },
      });
      setShowCloseOppositeModal(true);
      return;
    }

    // No opposite position, execute directly
    await executeOrder();
  }, [isAuthenticated, pacificaConnected, selectedMarket, selectedSide, orderSize, currentPrice, leverage, maxLeverage, inActiveFight, fightMaxSize, lotSize, apiPositions, executeOrder]);

  const handleCancelOrder = useCallback(async (orderId: string, symbol: string, orderType?: string) => {
    try {
      // Check if this is a stop order (TP/SL or standalone stop) - these need cancel_stop_order endpoint
      const isStopOrder = orderType && (orderType.includes('TP') || orderType.includes('SL') || orderType.includes('STOP'));

      if (isStopOrder) {
        // Stop orders need to use the stop/cancel endpoint
        await cancelStopOrder.mutateAsync({
          symbol,
          orderId: parseInt(orderId),
        });
      } else {
        // Regular order - use normal cancel
        await cancelOrder.mutateAsync({
          symbol,
          orderId: parseInt(orderId),
        });
      }
      // Refresh account data to update orders list
      await refetchAccount();
    } catch (err) {
      // Error notification is handled by the hook's onError handler
      console.error('Failed to cancel order:', err instanceof Error ? err.message : err);
    }
  }, [cancelOrder, cancelStopOrder, refetchAccount]);

  const handleEditOrder = useCallback((order: {
    id: string;
    symbol: string;
    side: string;
    price: string;
    size: string;
    type: string;
  }) => {
    // Only allow editing LIMIT orders (not TP/SL orders)
    if (order.type !== 'LIMIT') {
      return;
    }
    setEditingOrder({
      id: parseInt(order.id),
      symbol: order.symbol,
      side: order.side,
      price: order.price,
      size: order.size,
      type: order.type,
    });
    setShowEditOrderModal(true);
  }, []);

  const handleClosePosition = useCallback(async (
    positionId: string,
    closeType: 'market' | 'limit' | 'flip' = 'market',
    params?: LimitCloseParams | MarketCloseParams
  ) => {
    // Position ID is in format "SYMBOL-SIDE" (e.g., "BTC-USD-LONG")
    const parts = positionId.split('-');
    if (parts.length < 2) {
      console.error('Invalid position ID format:', positionId);
      return;
    }

    const side = parts[parts.length - 1];
    const symbolParts = parts.slice(0, -1);
    const symbol = symbolParts.join('-');

    const position = apiPositions.find((p) => p.symbol === symbol && p.side === side);

    if (!position || !symbol) {
      console.error('Position not found:', positionId);
      return;
    }

    const tokenSymbol = symbol.replace('-USD', '');

    try {
      if (closeType === 'limit' && params && 'price' in params) {
        // Close position with a reduce-only limit order
        const limitParams = params as LimitCloseParams;
        await createLimitOrder.mutateAsync({
          symbol: tokenSymbol,
          side: side === 'LONG' ? 'ask' : 'bid', // Opposite side to close
          amount: limitParams.amount,
          price: limitParams.price,
          reduceOnly: true,
        });
        // Toast is handled by useCreateLimitOrder
      } else if (closeType === 'flip') {
        // Flip position: close current and open opposite direction
        // Use 2x the position size in opposite direction to net flip
        const flipSide = side === 'LONG' ? 'ask' : 'bid';
        const doubleAmount = (parseFloat(position.size) * 2).toString();
        const newSide = side === 'LONG' ? 'Short' : 'Long';

        // Check if this is a pre-fight position
        // A position is pre-fight if we're in an active fight and the position is NOT in fightPositions
        const isPreFightPosition = inActiveFight && !fightPositions?.some(
          (fp) => fp.symbol === symbol && fp.side === side
        );

        await createMarketOrder.mutateAsync({
          symbol: tokenSymbol,
          side: flipSide,
          amount: doubleAmount,
          reduceOnly, // Not reduce-only because we want to open new position
          slippage_percent: '1',
          fightId: inActiveFight && fightId ? fightId : undefined,
          isPreFightFlip: isPreFightPosition, // Don't record this as a fight trade
        });

        // Show flip-specific toast
        toast.success(`Position flipped to ${newSide}: ${position.size} ${tokenSymbol}`);
      } else {
        // Close position with a reduce-only market order
        // Use partial amount if provided via MarketCloseParams
        const marketParams = params as MarketCloseParams | undefined;
        const closeAmount = marketParams?.amount || position.size;

        await createMarketOrder.mutateAsync({
          symbol: tokenSymbol,
          side: side === 'LONG' ? 'ask' : 'bid', // Opposite side to close
          amount: closeAmount,
          reduceOnly: true,
          slippage_percent: '1',
        });
        // Toast is handled by useCreateMarketOrder
      }

      // Refresh account data
      await refetchAccount();
    } catch (err) {
      // Error notification is handled by the hook's onError handler
      console.error('Failed to close position:', err instanceof Error ? err.message : err);
    }
  }, [apiPositions, createMarketOrder, createLimitOrder, refetchAccount, inActiveFight, fightId, fightPositions]);

  // Close all positions at market price
  const handleCloseAllPositions = useCallback(async () => {
    if (!apiPositions || apiPositions.length === 0) return;

    setIsClosingAllPositions(true);

    try {
      // Close each position with a market order
      for (const position of apiPositions) {
        const tokenSymbol = position.symbol.replace('-USD', '');
        const closeSide = position.side === 'LONG' ? 'ask' : 'bid';

        await createMarketOrder.mutateAsync({
          symbol: tokenSymbol,
          side: closeSide,
          amount: position.size,
          reduceOnly: true,
          slippage_percent: '1',
        });
      }

      toast.success(`Closed ${apiPositions.length} position${apiPositions.length > 1 ? 's' : ''}`);
      await refetchAccount();
    } catch (err) {
      console.error('Failed to close all positions:', err instanceof Error ? err.message : err);
      toast.error('Failed to close all positions');
    } finally {
      setIsClosingAllPositions(false);
    }
  }, [apiPositions, createMarketOrder, refetchAccount]);

  const handleSetTpSl = useCallback(async (params: TpSlParams) => {
    try {
      // For PARTIAL orders, use create_stop_order endpoint which supports custom amounts
      // The set_position_tpsl endpoint only supports full position TP/SL and overwrites existing orders
      if (params.isPartial && params.partialAmount) {
        const promises: Promise<any>[] = [];

        // Create partial TP order if specified
        if (params.takeProfit) {
          promises.push(
            createStopOrder.mutateAsync({
              symbol: params.symbol,
              side: params.side,
              stopPrice: params.takeProfit.stopPrice,
              amount: params.partialAmount,
              limitPrice: params.takeProfit.limitPrice,
              type: 'TAKE_PROFIT',
              fightId: fightId || undefined,
            })
          );
        }

        // Create partial SL order if specified
        if (params.stopLoss) {
          promises.push(
            createStopOrder.mutateAsync({
              symbol: params.symbol,
              side: params.side,
              stopPrice: params.stopLoss.stopPrice,
              amount: params.partialAmount,
              limitPrice: params.stopLoss.limitPrice,
              type: 'STOP_LOSS',
              fightId: fightId || undefined,
            })
          );
        }

        await Promise.all(promises);
      } else {
        // For FULL position TP/SL, use set_position_tpsl endpoint
        // Handle null = remove, object = set, undefined = no change
        const takeProfit = params.takeProfit === null
          ? null // Explicitly remove
          : params.takeProfit
            ? { stop_price: params.takeProfit.stopPrice, limit_price: params.takeProfit.limitPrice }
            : undefined; // No change

        const stopLoss = params.stopLoss === null
          ? null // Explicitly remove
          : params.stopLoss
            ? { stop_price: params.stopLoss.stopPrice, limit_price: params.stopLoss.limitPrice }
            : undefined; // No change

        await setPositionTpSl.mutateAsync({
          symbol: params.symbol,
          side: params.side,
          size: params.size,
          take_profit: takeProfit,
          stop_loss: stopLoss,
          fightId: fightId || undefined, // Track as fight order if in fight
        });
      }

      // Refresh account data
      await refetchAccount();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set TP/SL';
      console.error('Failed to set TP/SL:', message);
      toast.error(message);
    }
  }, [setPositionTpSl, createStopOrder, refetchAccount, fightId]);

  // Get account equity for cross margin liq price calculation
  const accountEquity = account ? parseFloat(account.accountEquity) || 0 : 0;

  // Convert API positions to component format with calculated PnL
  const displayPositions: Position[] = apiPositions.map((pos) => {
    const priceData = getPrice(pos.symbol);
    const entryPrice = parseFloat(pos.entryPrice) || 0;
    const markPrice = priceData?.price || entryPrice;
    const sizeInToken = parseFloat(pos.size) || 0; // Size in token units (e.g., 0.00011 BTC)
    const leverage = typeof pos.leverage === 'number' ? pos.leverage : parseInt(String(pos.leverage)) || 50;
    const funding = parseFloat(pos.funding || '0') || 0;
    const isolated = pos.isolated ?? false;

    // Position value in USD (at entry price, not mark price)
    const positionValueAtEntry = sizeInToken * entryPrice;
    const positionValueAtMark = sizeInToken * markPrice;

    // Margin calculation:
    // For isolated positions: use the margin from API
    // For cross positions: margin = positionValue / leverage
    const apiMargin = parseFloat(pos.margin) || 0;
    const margin = isolated && apiMargin > 0
      ? apiMargin
      : positionValueAtEntry / leverage;

    // Calculate unrealized PnL
    // For LONG: PnL = (markPrice - entryPrice) * sizeInToken
    // For SHORT: PnL = (entryPrice - markPrice) * sizeInToken
    const priceDiff = pos.side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
    const unrealizedPnl = priceDiff * sizeInToken;

    // ROI% = (PnL / margin) * 100
    const unrealizedPnlPercent = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

    // Use liquidation price from Pacifica WebSocket when available (most accurate)
    const apiLiqPrice = parseFloat(pos.liquidationPrice) || 0;
    let liquidationPrice: number;

    if (apiLiqPrice > 0) {
      // Real liq price from Pacifica WebSocket
      liquidationPrice = apiLiqPrice;
    } else {
      // Fallback: calculate using Pacifica's official formula
      // liquidation_price = [price - (side * position_margin) / position_size] / (1 - side / max_leverage / 2)
      const side = pos.side === 'LONG' ? 1 : -1;
      const mktMaxLeverage = leverage;
      const positionMargin = isolated && apiMargin > 0 ? apiMargin : accountEquity > 0 ? accountEquity : positionValueAtEntry / leverage;

      const numerator = entryPrice - (side * positionMargin) / sizeInToken;
      const denominator = 1 - side / mktMaxLeverage / 2;
      liquidationPrice = Math.max(0, numerator / denominator);
    }

    // Find TP/SL orders for this position
    // TP/SL orders have opposite side: LONG position → SHORT (ask) orders, SHORT position → LONG (bid) orders
    const posSymbol = pos.symbol.replace('-USD', '');
    const oppositeOrderSide = pos.side === 'LONG' ? 'SHORT' : 'LONG';

    // Find ALL Take Profit orders for this position
    // TP orders can be:
    // 1. Native Pacifica TP: order.type includes 'TP' or 'take_profit'
    // 2. Hybrid approach: reduce_only LIMIT orders on opposite side at profit-taking price
    //    - For LONG position: TP price is ABOVE entry price
    //    - For SHORT position: TP price is BELOW entry price
    const tpOrders = openOrders.filter(order => {
      const orderSymbol = order.symbol?.replace('-USD', '') || order.symbol;
      if (orderSymbol !== posSymbol || order.side !== oppositeOrderSide) return false;

      // Check for native Pacifica TP orders
      const isNativeTP = order.type?.includes('TP') || order.type?.toLowerCase().includes('take_profit');
      if (isNativeTP) return true;

      // Check for hybrid TP (limit orders with reduce_only at profit-taking price)
      // These are limit orders (not stop orders) that are reduce_only
      const isLimitOrder = order.type?.toUpperCase() === 'LIMIT' || order.type?.toLowerCase() === 'limit order';
      if (isLimitOrder && order.reduceOnly) {
        const orderPrice = parseFloat(order.price) || 0;
        // For LONG: TP is above entry, for SHORT: TP is below entry
        if (pos.side === 'LONG' && orderPrice > entryPrice) return true;
        if (pos.side === 'SHORT' && orderPrice < entryPrice) return true;
      }

      return false;
    }).map(order => ({
      orderId: order.id,
      type: 'TP' as const,
      triggerPrice: parseFloat(order.stopPrice || order.price) || 0,
      amount: parseFloat(order.size) || 0,
      orderType: (order.type?.includes('MARKET') ? 'market' : 'limit') as 'market' | 'limit',
      limitPrice: order.type?.includes('LIMIT') ? parseFloat(order.price) : undefined,
    }));

    // Find ALL Stop Loss orders for this position
    // SL orders can be:
    // 1. Native Pacifica SL: order.type includes 'SL' or 'stop_loss'
    // 2. Hybrid approach: reduce_only STOP orders on opposite side at loss-limiting price
    //    - For LONG position: SL price is BELOW entry price
    //    - For SHORT position: SL price is ABOVE entry price
    const slOrders = openOrders.filter(order => {
      const orderSymbol = order.symbol?.replace('-USD', '') || order.symbol;
      if (orderSymbol !== posSymbol || order.side !== oppositeOrderSide) return false;

      // Check for native Pacifica SL orders
      const isNativeSL = order.type?.includes('SL') || order.type?.toLowerCase().includes('stop_loss');
      if (isNativeSL) return true;

      // Check for hybrid SL (stop orders with reduce_only at loss-limiting price)
      // These are stop_market orders that are reduce_only
      const isStopOrder = order.type?.toUpperCase().includes('STOP') && !order.type?.includes('TP') && !order.type?.includes('SL');
      if (isStopOrder && order.reduceOnly) {
        const triggerPrice = parseFloat(order.stopPrice || order.price) || 0;
        // For LONG: SL is below entry, for SHORT: SL is above entry
        if (pos.side === 'LONG' && triggerPrice < entryPrice) return true;
        if (pos.side === 'SHORT' && triggerPrice > entryPrice) return true;
      }

      return false;
    }).map(order => ({
      orderId: order.id,
      type: 'SL' as const,
      triggerPrice: parseFloat(order.stopPrice || order.price) || 0,
      amount: parseFloat(order.size) || 0,
      orderType: (order.type?.includes('MARKET') ? 'market' : 'limit') as 'market' | 'limit',
      limitPrice: order.type?.includes('LIMIT') ? parseFloat(order.price) : undefined,
    }));

    // Extract trigger prices from first TP/SL orders (for backward compatibility)
    const takeProfit = tpOrders[0]?.triggerPrice;
    const stopLoss = slOrders[0]?.triggerPrice;

    return {
      id: `${pos.symbol}-${pos.side}`,
      symbol: pos.symbol,
      side: pos.side,
      size: positionValueAtMark, // Position value in USD at current mark price
      sizeInToken, // Size in token units
      entryPrice,
      markPrice,
      leverage,
      liquidationPrice,
      unrealizedPnl,
      unrealizedPnlPercent,
      margin,
      marginType: isolated ? 'Isolated' : 'Cross' as const,
      funding,
      takeProfit,
      stopLoss,
      tpOrders: tpOrders.length > 0 ? tpOrders : undefined,
      slOrders: slOrders.length > 0 ? slOrders : undefined,
    };
  });

  // When Reduce Only is ON, auto-select the closing side (opposite of current position)
  const currentMarketPosition = displayPositions.find(
    p => p.symbol.replace('-USD', '') === selectedMarket.replace('-USD', '')
  );
  useEffect(() => {
    if (reduceOnly && currentMarketPosition) {
      setSelectedSide(currentMarketPosition.side === 'LONG' ? 'SHORT' : 'LONG');
    }
  }, [reduceOnly, currentMarketPosition?.side]);

  // Convert fight positions to display format
  const displayFightPositions: Position[] = fightPositions.map((pos) => {
    const priceData = getPrice(pos.symbol);
    const entryPrice = parseFloat(pos.entryPrice) || 0;
    const markPrice = priceData?.price || parseFloat(pos.markPrice) || entryPrice;
    const sizeInToken = parseFloat(pos.size) || 0;
    const leverage = parseFloat(pos.leverage) || 1;
    const funding = parseFloat(pos.funding || '0') || 0;

    const positionValueAtMark = sizeInToken * markPrice;
    const positionValueAtEntry = sizeInToken * entryPrice;
    const margin = positionValueAtEntry / leverage;

    const priceDiff = pos.side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
    const unrealizedPnl = priceDiff * sizeInToken;
    const unrealizedPnlPercent = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

    return {
      id: `${pos.symbol}-${pos.side}`, // Same format as regular positions for handleClosePosition
      symbol: pos.symbol,
      side: pos.side,
      size: positionValueAtMark,
      sizeInToken,
      entryPrice,
      markPrice,
      leverage,
      liquidationPrice: 0, // Not calculated for fight positions
      unrealizedPnl,
      unrealizedPnlPercent,
      margin,
      marginType: 'Cross' as const,
      funding,
      takeProfit: undefined,
      stopLoss: undefined,
    };
  });

  // Choose which positions/trades/orders to display based on toggle
  // For Fight Only: use Pacifica positions (instant WebSocket) filtered by blockedSymbols
  // Since pre-fight symbols are blocked, all remaining positions are fight positions
  // This gives instant updates vs slow REST polling from displayFightPositions
  const fightFilteredPositions = displayPositions.filter(
    (pos) => !blockedSymbols.includes(pos.symbol)
  );
  const activePositions = showFightOnly && fightId ? fightFilteredPositions : displayPositions;
  const activeTrades = showFightOnly && fightId ? fightTrades : tradeHistory;
  const activeOpenOrders = showFightOnly && fightId ? fightOpenOrders : openOrders;
  const activeOrderHistory = showFightOnly && fightId ? fightOrderHistory : orderHistoryData;

  // Fee percentages (used in mobile info tab + order form)
  const pacificaTakerFee = parseFloat(account?.takerFee || '0.0007');
  const pacificaMakerFee = parseFloat(account?.makerFee || '0.000575');
  const takerFeePercent = ((pacificaTakerFee + TRADECLUB_FEE) * 100).toFixed(4);
  const makerFeePercent = ((pacificaMakerFee + TRADECLUB_FEE) * 100).toFixed(4);

  // Calculate real-time unrealized PnL from positions (updates with WebSocket prices)
  const realtimeUnrealizedPnl = displayPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);

  // Calculate fight PnL from filtered positions (for local display in positions table only)
  // Banner PnL comes from WebSocket (server-calculated) for consistency between clients
  const fightPnl = fightFilteredPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
  const fightMargin = fightFilteredPositions.reduce((sum, pos) => sum + pos.margin, 0);
  const fightRoi = fightMargin > 0 ? (fightPnl / fightMargin) * 100 : 0;

  const builderCodeApproved = builderCodeStatus?.approved ?? false;
  const canTrade = connected && isAuthenticated && pacificaConnected && builderCodeApproved;

  return (
    <BetaGate>
    <AppShell>
      {/* Fight Banner - Shows when in active fight */}
      {/* overflow-anchor: none prevents this dynamic element from affecting scroll position */}
      <div style={{ overflowAnchor: 'none' }}>
        <FightBanner />
      </div>

      {/* Active Fights Switcher - Shows when user has active fights */}
      {/* overflow-anchor: none prevents this dynamic element from affecting scroll position */}
      <div style={{ overflowAnchor: 'none' }}>
        <ActiveFightsSwitcher />
      </div>

      {/* Main container - overflow-anchor: none prevents scroll jumping when WebSocket updates components */}
      <div className="w-full px-1 py-1 touch-pan-y min-h-[calc(100vh-3rem)] max-[1199px]:pb-[60px]" style={{ overflowAnchor: 'none' }}>

        {/* ═══════════════════════════════════════════════════════════════════════
            MOBILE LAYOUT (< xl / < 1280px) — CEX-style (Binance/MEXC/Bybit)
            Market Info → Chart/OrderBook/Info (tabbed) → Positions → Sticky Buy/Sell
            ═══════════════════════════════════════════════════════════════════════ */}
        <div className="xl:hidden flex flex-col gap-1">
          {/* Mobile Market Info Bar */}
          <div className="card px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MarketSelector
                  markets={markets.length > 0 ? markets : [DEFAULT_MARKET]}
                  selectedMarket={selectedMarket}
                  onSelectMarket={handleMarketChange}
                  getPrice={getPrice}
                  blockedSymbols={inFight ? blockedSymbols : []}
                />
                <div className="flex flex-col">
                  <span className="text-sm text-white font-mono font-semibold">{formatPrice(currentPrice)}</span>
                  <span className={`text-xs font-mono font-medium ${priceChange >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                    {formatPercent(priceChange)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMarketInfo(!showMarketInfo)}
                className="p-1.5 rounded hover:bg-surface-800 transition-colors"
              >
                <svg className={`w-4 h-4 text-surface-400 transition-transform ${showMarketInfo ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {showMarketInfo && (
              <div className="pt-2 mt-2 border-t border-surface-800/50">
                <div className="grid grid-cols-3 gap-y-2.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-surface-500 mb-0.5">Mark</span>
                    <span className="text-[11px] text-white font-mono">{formatPrice(markPrice)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-surface-500 mb-0.5">24h Volume</span>
                    <span className="text-[11px] text-white font-mono">{formatUSD(volume24h)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-surface-500 mb-0.5">Open Interest</span>
                    <span className="text-[11px] text-white font-mono">{formatUSD(openInterest)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-surface-500 mb-0.5">Funding</span>
                    <span className={`text-[11px] font-mono ${nextFundingRate >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {formatFundingRate(nextFundingRate)} <span className="text-surface-500">/1h</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Section Tabs */}
          <div className="card flex items-center">
            {(['chart', 'orderbook', 'info'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileSection(tab)}
                className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors border-b-2 ${
                  mobileSection === tab
                    ? 'text-surface-200 border-surface-300'
                    : 'text-surface-400 border-transparent hover:text-white'
                }`}
              >
                {tab === 'chart' ? 'Chart' : tab === 'orderbook' ? 'Order Book' : 'Info'}
              </button>
            ))}
          </div>

          {/* Mobile Section Content */}
          <div className="card overflow-hidden">
            {mobileSection === 'chart' && (
              <div className="h-[400px]">
                <TradingViewChartAdvanced symbol={selectedMarket} height={400} />
              </div>
            )}
            {mobileSection === 'orderbook' && (
              <div className="h-[500px] overflow-y-auto">
                <OrderBook symbol={selectedMarket} currentPrice={currentPrice} oraclePrice={currentPrice} tickSize={tickSize} />
              </div>
            )}
            {mobileSection === 'info' && (
              <div className="p-4 space-y-4">
                <h3 className="text-sm font-semibold text-white">Market Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">Last Price</span>
                    <span className="text-sm text-white font-mono font-medium">{formatPrice(currentPrice)}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">Mark Price</span>
                    <span className="text-sm text-white font-mono font-medium">{formatPrice(markPrice)}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">24h Change</span>
                    <span className={`text-sm font-mono font-medium ${priceChange >= 0 ? 'text-win-400' : 'text-loss-400'}`}>{formatPercent(priceChange)}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">24h Volume</span>
                    <span className="text-sm text-white font-mono font-medium">{formatUSD(volume24h)}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">Open Interest</span>
                    <span className="text-sm text-white font-mono font-medium">{formatUSD(openInterest)}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">Funding Rate</span>
                    <span className={`text-sm font-mono font-medium ${nextFundingRate >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {formatFundingRate(nextFundingRate)} <span className="text-surface-500">/1h</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">Maker Fee</span>
                    <span className="text-sm text-white font-mono font-medium">{makerFeePercent}%</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-surface-800 rounded-lg">
                    <span className="text-[10px] text-surface-400 uppercase">Taker Fee</span>
                    <span className="text-sm text-white font-mono font-medium">{takerFeePercent}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Positions/Orders/Trades/History Tabs — reuse the same panel */}
          <div className="card h-[calc(100vh-16rem)] flex flex-col overflow-hidden" style={{ contain: 'layout' }}>
            {/* Tab navigation */}
            <div className="flex items-center justify-between border-surface-800 flex-shrink-0">
              <div className="flex items-center w-full gap-0">
                <button
                  onClick={() => setBottomTab('positions')}
                  className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${bottomTab === 'positions'
                    ? 'text-surface-200 border-surface-300'
                    : 'text-surface-400 border-transparent hover:text-white'
                    }`}
                >
                  Positions {activePositions.length > 0 && <span className="ml-1 text-xs bg-surface-700 px-1.5 py-0.5 rounded">{activePositions.length}</span>}
                </button>
                <button
                  onClick={() => setBottomTab('orders')}
                  className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${bottomTab === 'orders'
                    ? 'text-surface-200 border-surface-300'
                    : 'text-surface-400 border-transparent hover:text-white'
                    }`}
                >
                  Orders {activeOpenOrders.length > 0 && <span className="ml-1 text-xs bg-surface-700 px-1.5 py-0.5 rounded">{activeOpenOrders.length}</span>}
                </button>
                <button
                  onClick={() => setBottomTab('trades')}
                  className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${bottomTab === 'trades'
                    ? 'text-surface-200 border-surface-300'
                    : 'text-surface-400 border-transparent hover:text-white'
                    }`}
                >
                  Trades
                </button>
                <button
                  onClick={() => setBottomTab('history')}
                  className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors ${bottomTab === 'history'
                    ? 'text-surface-200 border-surface-300'
                    : 'text-surface-400 border-transparent hover:text-white'
                    }`}
                >
                  History
                </button>
              </div>
              {/* Fight filter toggle */}
              {fightId && (
                <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5 mr-2 flex-shrink-0">
                  <button
                    onClick={() => setShowFightOnly(false)}
                    className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${!showFightOnly
                      ? 'bg-surface-600 text-white'
                      : 'text-surface-400 hover:text-white'
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setShowFightOnly(true)}
                    className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${showFightOnly
                      ? 'bg-surface-500/30 text-white'
                      : 'text-surface-400 hover:text-white'
                      }`}
                  >
                    Fight
                  </button>
                </div>
              )}
            </div>
            {/* Tab content */}
            <div className={`flex-1 ${bottomTab === 'positions' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
              {bottomTab === 'positions' && (
                <Positions
                  positions={activePositions}
                  onClosePosition={handleClosePosition}
                  onSetTpSl={handleSetTpSl}
                  onCancelOrder={handleCancelOrder}
                  onCloseAll={handleCloseAllPositions}
                  isClosingAll={isClosingAllPositions}
                />
              )}
              {bottomTab === 'orders' && (
                activeOpenOrders.length > 0 ? (
                  <div className="px-1">
                    <div className="flex justify-end px-2 py-1.5">
                      <button onClick={() => cancelAllOrders.mutate({})} disabled={cancelAllOrders.isPending} className="text-surface-300 hover:text-white transition-colors disabled:opacity-50 text-xs">Cancel All</button>
                    </div>
                    {[...activeOpenOrders].sort((a, b) => {
                      const getValue = (order: any) => {
                        switch (ordersSort.col) {
                          case 'time': return order.createdAt ? new Date(order.createdAt).getTime() : 0;
                          case 'type': return order.type || '';
                          case 'token': return order.symbol || '';
                          case 'side': return order.side || '';
                          case 'originalSize': return parseFloat(order.size) || 0;
                          case 'filledSize': return parseFloat(order.filled) || 0;
                          case 'price': return parseFloat(order.price) || 0;
                          case 'value': return (parseFloat(order.size) || 0) * (parseFloat(order.price) || 0);
                          case 'reduceOnly': return order.reduceOnly ? 1 : 0;
                          case 'trigger': return order.stopPrice ? parseFloat(order.stopPrice) : 0;
                          default: return 0;
                        }
                      };
                      const valA = getValue(a);
                      const valB = getValue(b);
                      if (typeof valA === 'string') return ordersSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                      return ordersSort.desc ? valB - valA : valA - valB;
                    }).map((order) => {
                      const price = parseFloat(order.price) || 0;
                      const originalSize = parseFloat(order.size) || 0;
                      const filledSize = parseFloat(order.filled) || 0;
                      const timestamp = order.createdAt ? new Date(order.createdAt) : new Date();
                      const isNativeTpSl = order.type.includes('TP') || order.type.includes('SL') || order.type.toLowerCase().includes('take_profit') || order.type.toLowerCase().includes('stop_loss');
                      const isHybridTp = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase() === 'LIMIT';
                      const isHybridSl = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase().includes('STOP');
                      const isTpSl = isNativeTpSl || isHybridTp || isHybridSl;
                      let displayType = order.type;
                      if (order.type.includes('TP') || order.type.toLowerCase().includes('take_profit')) displayType = 'Take Profit Market';
                      else if (order.type.includes('SL') || order.type.toLowerCase().includes('stop_loss')) displayType = 'Stop Loss Market';
                      else if (isHybridTp) displayType = 'TP (Partial)';
                      else if (isHybridSl) displayType = 'SL (Partial)';
                      else if (order.type === 'LIMIT') displayType = 'Limit Order';
                      else if (order.type === 'STOP_LIMIT') displayType = 'Stop Limit';
                      else if (order.type === 'STOP_MARKET') displayType = 'Stop Market';
                      const stopPrice = order.stopPrice ? parseFloat(order.stopPrice) : null;
                      const orderValue = originalSize * (price || stopPrice || 0);
                      const formatSize = (size: number) => {
                        if (size < 0.0001) return size.toFixed(8);
                        if (size < 0.01) return size.toFixed(6);
                        if (size < 1) return size.toFixed(5);
                        return size.toFixed(4);
                      };

                      return (
                        <div key={order.id} className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5">
                          {/* Header */}
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="font-medium text-white text-sm">{order.symbol}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              isTpSl ? (displayType.includes('Take Profit') || displayType.includes('TP') ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400')
                                : 'bg-surface-700 text-surface-300'
                            }`}>
                              {displayType}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${order.side === 'LONG' ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400'}`}>
                              {order.side === 'LONG' ? 'Long' : 'Short'}
                            </span>
                          </div>
                          {/* Data grid */}
                          <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                            <div>
                              <div className="text-surface-500">Time</div>
                              <div className="font-mono text-surface-300">{timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}, {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Original Size</div>
                              <div className="font-mono text-white">{formatSize(originalSize)} {order.symbol}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Filled Size</div>
                              <div className="font-mono text-surface-300">{filledSize}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Price</div>
                              <div className="font-mono text-surface-300">{isTpSl ? 'Market' : order.type.includes('STOP') && !price ? 'Market' : price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 0 })}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Order Value</div>
                              <div className="font-mono text-surface-300">${orderValue.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Reduce Only</div>
                              <div className="text-surface-300">{order.reduceOnly ? 'Yes' : 'No'}</div>
                            </div>
                            {stopPrice && (
                              <div>
                                <div className="text-surface-500">Trigger Condition</div>
                                <div className="font-mono text-surface-300">${stopPrice.toLocaleString()} / Last</div>
                              </div>
                            )}
                          </div>
                          {/* Cancel button */}
                          <div className="mt-2.5 pt-2 border-t border-surface-800/50">
                            <button
                              onClick={() => handleCancelOrder(order.id, order.symbol, order.type)}
                              disabled={cancelOrder.isPending || cancelStopOrder.isPending}
                              className="text-surface-300 hover:text-white transition-colors disabled:opacity-50 text-xs"
                            >
                              {isTpSl ? 'Remove' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-sm text-surface-500">
                    {showFightOnly && fightId ? 'No open orders during this fight' : 'No open orders'}
                  </div>
                )
              )}
              {bottomTab === 'trades' && (
                activeTrades.length > 0 ? (
                  <div className="px-1">
                    {[...activeTrades].sort((a: any, b: any) => {
                      const getValue = (trade: any) => {
                        switch (tradesSort.col) {
                          case 'time': return trade.created_at || 0;
                          case 'token': return trade.symbol?.replace('-USD', '') || '';
                          case 'side': return trade.side || '';
                          case 'size': return parseFloat(trade.amount) || 0;
                          case 'price': return parseFloat(trade.price) || 0;
                          case 'value': return (parseFloat(trade.price) || 0) * (parseFloat(trade.amount) || 0);
                          case 'fee': return parseFloat(trade.fee) || 0;
                          case 'pnl': return parseFloat(trade.pnl) || 0;
                          default: return 0;
                        }
                      };
                      const valA = getValue(a);
                      const valB = getValue(b);
                      if (typeof valA === 'string') return tradesSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                      return tradesSort.desc ? valB - valA : valA - valB;
                    }).map((trade: any, index: number) => {
                      const price = parseFloat(trade.price) || 0;
                      const amount = parseFloat(trade.amount) || 0;
                      const realizedPnl = parseFloat(trade.pnl) || 0;
                      const fee = parseFloat(trade.fee) || 0;
                      const tradeValue = price * amount;
                      const timestamp = trade.created_at ? new Date(trade.created_at) : new Date();
                      const sideFormatted = trade.side?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';
                      const isLong = trade.side?.includes('long');
                      const isClose = trade.side?.includes('close');
                      const sideColor = isClose ? (realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400') : (isLong ? 'text-win-400' : 'text-loss-400');
                      const token = trade.symbol?.replace('-USD', '') || '';

                      return (
                        <div key={trade.history_id || index} className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5">
                          {/* Header */}
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="font-medium text-white text-sm">{token}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${sideColor} ${isClose ? (realizedPnl >= 0 ? 'bg-win-500/20' : 'bg-loss-500/20') : (isLong ? 'bg-win-500/20' : 'bg-loss-500/20')}`}>
                              {sideFormatted}
                            </span>
                            <span className={`font-mono text-xs font-medium ${realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                              {realizedPnl >= 0 ? '+' : '-'}${Math.abs(realizedPnl).toFixed(2)}
                            </span>
                          </div>
                          {/* Data grid */}
                          <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                            <div>
                              <div className="text-surface-500">Time</div>
                              <div className="font-mono text-surface-300">{timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}, {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Side</div>
                              <div className={`font-medium ${sideColor}`}>{sideFormatted}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Order Type</div>
                              <div className="text-surface-300">Fulfill Taker</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Size</div>
                              <div className="font-mono text-white">{amount.toFixed(amount < 0.01 ? 5 : 4)} {token}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Price</div>
                              <div className="font-mono text-surface-300">{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Trade Value</div>
                              <div className="font-mono text-surface-300">${tradeValue.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Fees</div>
                              <div className="font-mono text-surface-300">${fee.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {!showFightOnly && hasMoreTrades && (
                      <div className="p-3 text-center">
                        <button onClick={() => fetchMoreTrades()} disabled={isLoadingMoreTrades} className="text-xs text-surface-300 hover:text-white transition-colors disabled:opacity-50">
                          {isLoadingMoreTrades ? 'Loading...' : 'Load More'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-sm text-surface-500">
                    {showFightOnly && fightId ? 'No trades during this fight' : 'No trade history'}
                  </div>
                )
              )}
              {bottomTab === 'history' && (
                activeOrderHistory.length > 0 ? (
                  <div className="px-1">
                    {[...activeOrderHistory].sort((a: any, b: any) => {
                      const getValue = (order: any) => {
                        switch (orderHistorySort.col) {
                          case 'time': return order.created_at || 0;
                          case 'token': return order.symbol || '';
                          case 'side': return order.side || '';
                          case 'type': return order.order_type || '';
                          case 'originalSize': return parseFloat(order.amount) || 0;
                          case 'filledSize': return parseFloat(order.filled_amount) || 0;
                          case 'initialPrice': return parseFloat(order.initial_price || order.stop_price) || 0;
                          case 'avgPrice': return parseFloat(order.average_filled_price) || 0;
                          case 'value': { const f = parseFloat(order.filled_amount) || 0; const p = parseFloat(order.average_filled_price) || 0; return f * p; }
                          case 'status': return order.order_status || '';
                          case 'orderId': return order.order_id || 0;
                          default: return 0;
                        }
                      };
                      const valA = getValue(a);
                      const valB = getValue(b);
                      if (typeof valA === 'string') return orderHistorySort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                      return orderHistorySort.desc ? valB - valA : valA - valB;
                    }).slice(0, 50).map((order: any, index: number) => {
                      const orderSide = order.side === 'bid' ? 'Long' : 'Short';
                      const rawOrderType = order.order_type || 'limit';
                      const orderType = rawOrderType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                      const filledAmount = parseFloat(order.filled_amount || '0');
                      const initialAmount = parseFloat(order.amount || '0');
                      const avgFilledPrice = parseFloat(order.average_filled_price || '0');
                      const stopPrice = parseFloat(order.stop_price || '0');
                      const initialPrice = parseFloat(order.initial_price || '0');
                      const isTpSlOrder = rawOrderType.includes('stop_loss') || rawOrderType.includes('take_profit');
                      const isRegularMarketOrder = rawOrderType === 'market';
                      const orderValue = filledAmount > 0 && avgFilledPrice > 0 ? filledAmount * avgFilledPrice : 0;
                      let status = 'Open';
                      const rawStatus = order.order_status || '';
                      if (rawStatus) {
                        switch (rawStatus.toLowerCase()) {
                          case 'open': status = 'Open'; break;
                          case 'partially_filled': status = 'Partial'; break;
                          case 'filled': status = 'Filled'; break;
                          case 'cancelled': status = 'Cancelled'; break;
                          case 'rejected': status = 'Rejected'; break;
                          default: status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
                        }
                      }
                      const formatHistPrice = (price: number) => {
                        if (price === 0) return 'N/A';
                        if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
                        if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
                        return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
                      };
                      const timestamp = order.created_at ? new Date(order.created_at) : null;

                      return (
                        <div key={order.order_id || index} className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5">
                          {/* Header */}
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="font-medium text-white text-sm">{order.symbol}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${orderSide === 'Long' ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400'}`}>{orderSide}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-700 text-surface-300">{orderType}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${status === 'Filled' ? 'bg-win-500/20 text-win-400' : status === 'Cancelled' ? 'bg-surface-600/50 text-surface-400' : status === 'Partial' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-surface-500/20 text-surface-300'}`}>{status}</span>
                          </div>
                          {/* Data grid */}
                          <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                            <div>
                              <div className="text-surface-500">Time</div>
                              <div className="font-mono text-surface-300">{timestamp ? `${timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}, ${timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}` : '-'}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Original Size</div>
                              <div className="font-mono text-surface-200">{isTpSlOrder ? 'N/A' : `${initialAmount.toFixed(5)} ${order.symbol}`}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Filled Size</div>
                              <div className="font-mono text-surface-200">{isTpSlOrder ? 'N/A' : `${filledAmount.toFixed(5)} ${order.symbol}`}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Initial Price</div>
                              <div className="font-mono text-surface-200">{isTpSlOrder ? formatHistPrice(stopPrice) : (isRegularMarketOrder ? 'Market' : formatHistPrice(initialPrice))}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Avg Filled Price</div>
                              <div className="font-mono text-surface-200">{isTpSlOrder ? 'N/A' : (avgFilledPrice > 0 ? formatHistPrice(avgFilledPrice) : 'N/A')}</div>
                            </div>
                            <div>
                              <div className="text-surface-500">Order Value</div>
                              <div className="font-mono text-win-400">{isTpSlOrder ? 'N/A' : (orderValue > 0 ? `$${orderValue.toFixed(2)}` : 'N/A')}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-sm text-surface-500">
                    {showFightOnly && fightId ? 'No order history during this fight' : 'No order history'}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            DESKTOP LAYOUT (>= xl / >= 1280px) — Original 5-column grid
            ═══════════════════════════════════════════════════════════════════════ */}
        <div className="hidden xl:grid xl:grid-cols-5 gap-1 h-full" style={{ transform: 'translateZ(0)' }}>
          {/* Left column wrapper */}
          <div className="col-span-4 flex flex-col gap-1 order-1 h-full">
            {/* Top row: Order Book + Chart */}
            <div className="grid grid-cols-12 gap-1">
              {/* Order Book - 3 cols on desktop */}
              <div className="col-span-3 order-2 card overflow-hidden h-full flex flex-col" style={{ contain: 'layout' }}>
                <div className="px-3 py-2 border-surface-800 flex-shrink-0">
                  <h3 className="font-display font-semibold text-sm uppercase tracking-wide">
                    Order Book
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-y-auto isolate" style={{ contain: 'strict' }}>
                  <OrderBook symbol={selectedMarket} currentPrice={currentPrice} oraclePrice={currentPrice} tickSize={tickSize} />
                </div>
              </div>

              {/* Chart - 9 cols on desktop */}
              <div className="col-span-9 order-1 card overflow-hidden">
                {/* Chart Header - Market Info (Desktop) */}
                <div className="px-4 py-2">
                  <div className="flex items-center gap-6 text-sm">
                    <MarketSelector
                      markets={markets.length > 0 ? markets : [DEFAULT_MARKET]}
                      selectedMarket={selectedMarket}
                      onSelectMarket={handleMarketChange}
                      getPrice={getPrice}
                      blockedSymbols={inFight ? blockedSymbols : []}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs text-surface-300">Last Price</span>
                      <span className="text-xs text-white font-mono font-medium">{formatPrice(currentPrice)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-surface-300">Mark</span>
                      <span className="text-xs text-white font-mono font-medium">{formatPrice(markPrice)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-surface-300">24h Change</span>
                      <span className={`text-xs font-mono font-medium ${priceChange >= 0 ? 'text-win-400' : 'text-loss-400'}`}>{formatPercent(priceChange)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-surface-300">24h Volume</span>
                      <span className="text-xs text-white font-mono font-medium">{formatUSD(volume24h)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-surface-300">Open Interest</span>
                      <span className="text-xs text-white font-mono font-medium">{formatUSD(openInterest)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-surface-300">Next Funding / Countdown</span>
                      <span className={`text-xs font-mono font-medium ${nextFundingRate >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                        {formatFundingRate(nextFundingRate)} <span className="text-surface-400">/1h</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile market info removed — handled by mobile layout above */}
                {/* Chart */}
                <div className="h-[650px]">
                  <TradingViewChartAdvanced
                    symbol={selectedMarket}
                    height={650}
                  />
                </div>
              </div>
            </div>

            {/* Positions Panel (Desktop) */}
            <div className="order-4 card min-h-[400px] flex flex-col overflow-hidden" style={{ contain: 'strict' }}>
              {/* Tab navigation */}
              <div className="flex items-center justify-between border-surface-800 flex-shrink-0 overflow-x-auto">
                <div className="flex items-center gap-6 px-4 min-w-max">
                  <button
                    onClick={() => setBottomTab('positions')}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${bottomTab === 'positions'
                      ? 'text-surface-200 border-surface-300'
                      : 'text-surface-400 border-transparent hover:text-white'
                      }`}
                  >
                    Positions {activePositions.length > 0 && <span className="ml-1 text-xs bg-surface-700 px-1.5 py-0.5 rounded">{activePositions.length}</span>}
                  </button>
                  <button
                    onClick={() => setBottomTab('orders')}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${bottomTab === 'orders'
                      ? 'text-surface-200 border-surface-300'
                      : 'text-surface-400 border-transparent hover:text-white'
                      }`}
                  >
                    Open Orders
                    {activeOpenOrders.length > 0 && <span className="ml-1 text-xs bg-surface-700 px-1.5 py-0.5 rounded">{activeOpenOrders.length}</span>}
                  </button>
                  <button
                    onClick={() => setBottomTab('trades')}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${bottomTab === 'trades'
                      ? 'text-surface-200 border-surface-300'
                      : 'text-surface-400 border-transparent hover:text-white'
                      }`}
                  >
                    Trade History
                  </button>
                  <button
                    onClick={() => setBottomTab('history')}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${bottomTab === 'history'
                      ? 'text-surface-200 border-surface-300'
                      : 'text-surface-400 border-transparent hover:text-white'
                      }`}
                  >
                    Order History
                  </button>
                </div>

                {/* Fight filter toggle - only show when in active fight */}
                {fightId && (
                  <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1 mx-4 flex-shrink-0">
                    <button
                      onClick={() => setShowFightOnly(false)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${!showFightOnly
                        ? 'bg-surface-600 text-white'
                        : 'text-surface-400 hover:text-white'
                        }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setShowFightOnly(true)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${showFightOnly
                        ? 'bg-surface-500 text-white'
                        : 'text-surface-400 hover:text-white'
                        }`}
                    >
                      Fight Only
                    </button>
                  </div>
                )}
              </div>

              {/* Tab content - scrollable with overscroll containment to prevent scroll chaining on mobile */}
              <div className={`flex-1 ${bottomTab === 'positions' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overflow-x-auto overscroll-y-auto'}`}>
                {bottomTab === 'positions' && (
                  <Positions
                    positions={activePositions}
                    onClosePosition={handleClosePosition}
                    onSetTpSl={handleSetTpSl}
                    onCancelOrder={handleCancelOrder}
                    onCloseAll={handleCloseAllPositions}
                    isClosingAll={isClosingAllPositions}
                  />
                )}
                {bottomTab === 'orders' && (
                  activeOpenOrders.length > 0 ? (
                    <div>
                      {/* Mobile card view for orders */}
                      <div className="max-[1199px]:block hidden space-y-2 px-1">
                        <div className="flex justify-end mb-1">
                          <button onClick={() => cancelAllOrders.mutate({})} disabled={cancelAllOrders.isPending} className="text-surface-300 hover:text-white transition-colors disabled:opacity-50 text-xs">Cancel All</button>
                        </div>
                        {[...activeOpenOrders].sort((a, b) => {
                          const getValue = (order: any) => {
                            switch (ordersSort.col) {
                              case 'time': return order.createdAt ? new Date(order.createdAt).getTime() : 0;
                              case 'type': return order.type || '';
                              case 'token': return order.symbol || '';
                              case 'side': return order.side || '';
                              case 'originalSize': return parseFloat(order.size) || 0;
                              case 'filledSize': return parseFloat(order.filled) || 0;
                              case 'price': return parseFloat(order.price) || 0;
                              case 'value': return (parseFloat(order.size) || 0) * (parseFloat(order.price) || 0);
                              case 'reduceOnly': return order.reduceOnly ? 1 : 0;
                              case 'trigger': return order.stopPrice ? parseFloat(order.stopPrice) : 0;
                              default: return 0;
                            }
                          };
                          const valA = getValue(a);
                          const valB = getValue(b);
                          if (typeof valA === 'string') return ordersSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                          return ordersSort.desc ? valB - valA : valA - valB;
                        }).map((order) => {
                          const price = parseFloat(order.price) || 0;
                          const originalSize = parseFloat(order.size) || 0;
                          const filledSize = parseFloat(order.filled) || 0;
                          const timestamp = order.createdAt ? new Date(order.createdAt) : new Date();
                          const isNativeTpSl = order.type.includes('TP') || order.type.includes('SL') || order.type.toLowerCase().includes('take_profit') || order.type.toLowerCase().includes('stop_loss');
                          const isHybridTp = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase() === 'LIMIT';
                          const isHybridSl = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase().includes('STOP');
                          const isTpSl = isNativeTpSl || isHybridTp || isHybridSl;
                          let displayType = order.type;
                          if (order.type.includes('TP') || order.type.toLowerCase().includes('take_profit')) displayType = 'Take Profit Market';
                          else if (order.type.includes('SL') || order.type.toLowerCase().includes('stop_loss')) displayType = 'Stop Loss Market';
                          else if (isHybridTp) displayType = 'TP (Partial)';
                          else if (isHybridSl) displayType = 'SL (Partial)';
                          else if (order.type === 'LIMIT') displayType = 'Limit Order';
                          else if (order.type === 'STOP_LIMIT') displayType = 'Stop Limit';
                          else if (order.type === 'STOP_MARKET') displayType = 'Stop Market';
                          const stopPrice = order.stopPrice ? parseFloat(order.stopPrice) : null;
                          const orderValue = originalSize * (price || stopPrice || 0);
                          const formatSize = (size: number) => {
                            if (size < 0.0001) return size.toFixed(8);
                            if (size < 0.01) return size.toFixed(6);
                            if (size < 1) return size.toFixed(5);
                            return size.toFixed(4);
                          };

                          return (
                            <div key={order.id} className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5">
                              {/* Header */}
                              <div className="flex items-center gap-2 mb-2.5">
                                <span className="font-medium text-white text-sm">{order.symbol}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isTpSl ? (displayType.includes('Take Profit') || displayType.includes('TP') ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400')
                                    : 'bg-surface-700 text-surface-300'
                                }`}>
                                  {displayType}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${order.side === 'LONG' ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400'}`}>
                                  {order.side === 'LONG' ? 'Long' : 'Short'}
                                </span>
                              </div>
                              {/* Data grid */}
                              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                                <div>
                                  <div className="text-surface-500">Time</div>
                                  <div className="font-mono text-surface-300">{timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}, {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Original Size</div>
                                  <div className="font-mono text-white">{formatSize(originalSize)} {order.symbol}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Filled Size</div>
                                  <div className="font-mono text-surface-300">{filledSize}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Price</div>
                                  <div className="font-mono text-surface-300">{isTpSl ? 'Market' : order.type.includes('STOP') && !price ? 'Market' : price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 0 })}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Order Value</div>
                                  <div className="font-mono text-surface-300">${orderValue.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Reduce Only</div>
                                  <div className="text-surface-300">{order.reduceOnly ? 'Yes' : 'No'}</div>
                                </div>
                                {stopPrice && (
                                  <div>
                                    <div className="text-surface-500">Trigger Condition</div>
                                    <div className="font-mono text-surface-300">${stopPrice.toLocaleString()} / Last</div>
                                  </div>
                                )}
                              </div>
                              {/* Cancel button */}
                              <div className="mt-2.5 pt-2 border-t border-surface-800/50">
                                <button
                                  onClick={() => handleCancelOrder(order.id, order.symbol, order.type)}
                                  disabled={cancelOrder.isPending || cancelStopOrder.isPending}
                                  className="text-surface-300 hover:text-white transition-colors disabled:opacity-50 text-xs"
                                >
                                  {isTpSl ? 'Remove' : 'Cancel'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Desktop table view */}
                      <div className="overflow-x-auto max-[1199px]:hidden">
                      <table className="w-full text-xs min-w-[900px]">
                        <thead>
                          <tr className="text-xs text-surface-400 tracking-wider">
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'time')}>Time {ordersSort.col === 'time' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'type')}>Order Type {ordersSort.col === 'type' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'token')}>Token {ordersSort.col === 'token' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'side')}>Side {ordersSort.col === 'side' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'originalSize')}>Original Size {ordersSort.col === 'originalSize' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'filledSize')}>Filled Size {ordersSort.col === 'filledSize' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'price')}>Price {ordersSort.col === 'price' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'value')}>Order Value {ordersSort.col === 'value' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'reduceOnly')}>Reduce Only {ordersSort.col === 'reduceOnly' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(ordersSort, setOrdersSort, 'trigger')}>Trigger {ordersSort.col === 'trigger' && (ordersSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium">
                              <button onClick={() => cancelAllOrders.mutate({})} disabled={cancelAllOrders.isPending} className="text-surface-300 hover:text-white transition-colors disabled:opacity-50">Cancel All</button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...activeOpenOrders].sort((a, b) => {
                            const getValue = (order: any) => {
                              switch (ordersSort.col) {
                                case 'time': return order.createdAt ? new Date(order.createdAt).getTime() : 0;
                                case 'type': return order.type || '';
                                case 'token': return order.symbol || '';
                                case 'side': return order.side || '';
                                case 'originalSize': return parseFloat(order.size) || 0;
                                case 'filledSize': return parseFloat(order.filled) || 0;
                                case 'price': return parseFloat(order.price) || 0;
                                case 'value': return (parseFloat(order.size) || 0) * (parseFloat(order.price) || 0);
                                case 'reduceOnly': return order.reduceOnly ? 1 : 0;
                                case 'trigger': return order.stopPrice ? parseFloat(order.stopPrice) : 0;
                                default: return 0;
                              }
                            };
                            const valA = getValue(a);
                            const valB = getValue(b);
                            if (typeof valA === 'string') return ordersSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                            return ordersSort.desc ? valB - valA : valA - valB;
                          }).map((order) => {
                            const price = parseFloat(order.price) || 0;
                            const originalSize = parseFloat(order.size) || 0;
                            const filledSize = parseFloat(order.filled) || 0;
                            const timestamp = order.createdAt ? new Date(order.createdAt) : new Date();
                            const isNativeTpSl = order.type.includes('TP') || order.type.includes('SL') || order.type.toLowerCase().includes('take_profit') || order.type.toLowerCase().includes('stop_loss');
                            const isHybridTp = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase() === 'LIMIT';
                            const isHybridSl = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase().includes('STOP');
                            const isTpSl = isNativeTpSl || isHybridTp || isHybridSl;
                            let displayType = order.type;
                            if (order.type.includes('TP') || order.type.toLowerCase().includes('take_profit')) displayType = 'TP MARKET';
                            else if (order.type.includes('SL') || order.type.toLowerCase().includes('stop_loss')) displayType = 'SL MARKET';
                            else if (isHybridTp) displayType = 'TP (Partial)';
                            else if (isHybridSl) displayType = 'SL (Partial)';
                            else if (order.type === 'LIMIT') displayType = 'Limit Order';
                            else if (order.type === 'STOP_LIMIT') displayType = 'Stop Limit';
                            else if (order.type === 'STOP_MARKET') displayType = 'Stop Market';
                            const stopPrice = order.stopPrice ? parseFloat(order.stopPrice) : null;
                            const orderValue = originalSize * (price || stopPrice || 0);
                            const formatSize = (size: number) => {
                              if (size < 0.0001) return size.toFixed(8);
                              if (size < 0.01) return size.toFixed(6);
                              if (size < 1) return size.toFixed(5);
                              return size.toFixed(4);
                            };
                            return (
                              <tr key={order.id} className="border-surface-800/50 hover:bg-surface-800/30">
                                <td className="py-2 px-2 text-surface-300 whitespace-nowrap font-mono">{timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
                                <td className="py-2 px-2 text-surface-300">{displayType}</td>
                                <td className="py-2 px-2"><span className="text-surface-300">{order.symbol}</span></td>
                                <td className="py-2 px-2"><span className={`font-medium ${order.side === 'LONG' ? 'text-win-400' : 'text-loss-400'}`}>{order.side === 'LONG' ? 'Long' : 'Short'}</span></td>
                                <td className="py-2 px-2 font-mono text-white">{formatSize(originalSize)} {order.symbol}</td>
                                <td className="py-2 px-2 font-mono text-surface-400">{filledSize}</td>
                                <td className="py-2 px-2 font-mono text-surface-300">
                                  {isTpSl ? 'Market' : order.type.includes('STOP') && !price ? 'Market' : order.type.includes('STOP') ? (
                                    price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 0 })
                                  ) : (
                                    <button onClick={() => handleEditOrder({ id: order.id, symbol: order.symbol, side: order.side, price: order.price, size: order.size, type: order.type })} className="inline-flex items-center gap-1 hover:text-white transition-colors group" title="Edit order price">
                                      {price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 0 })}
                                      <svg className="w-3 h-3 text-surface-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                    </button>
                                  )}
                                </td>
                                <td className="py-2 px-2 font-mono text-surface-300">${orderValue.toFixed(2)}</td>
                                <td className="py-2 px-2 text-surface-300">{order.reduceOnly ? 'Yes' : 'No'}</td>
                                <td className="py-2 px-2 text-surface-400">{stopPrice ? `$${stopPrice.toLocaleString()}` : 'N/A'}</td>
                                <td className="py-2 px-2">
                                  <button onClick={() => handleCancelOrder(order.id, order.symbol, order.type)} disabled={cancelOrder.isPending || cancelStopOrder.isPending} className="text-surface-300 hover:text-white transition-colors disabled:opacity-50">{isTpSl ? 'Remove' : 'Cancel'}</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-surface-500 text-xs">
                      {showFightOnly && fightId ? 'No open orders during this fight' : 'No open orders'}
                    </div>
                  )
                )}
                {bottomTab === 'trades' && (
                  activeTrades.length > 0 ? (
                    <div>
                      {/* Mobile card view for trades */}
                      <div className="max-[1199px]:block hidden space-y-2 px-1">
                        {[...activeTrades].sort((a: any, b: any) => {
                          const getValue = (trade: any) => {
                            switch (tradesSort.col) {
                              case 'time': return trade.created_at || 0;
                              case 'token': return trade.symbol?.replace('-USD', '') || '';
                              case 'side': return trade.side || '';
                              case 'size': return parseFloat(trade.amount) || 0;
                              case 'price': return parseFloat(trade.price) || 0;
                              case 'value': return (parseFloat(trade.price) || 0) * (parseFloat(trade.amount) || 0);
                              case 'fee': return parseFloat(trade.fee) || 0;
                              case 'pnl': return parseFloat(trade.pnl) || 0;
                              default: return 0;
                            }
                          };
                          const valA = getValue(a);
                          const valB = getValue(b);
                          if (typeof valA === 'string') return tradesSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                          return tradesSort.desc ? valB - valA : valA - valB;
                        }).map((trade: any, index: number) => {
                          const price = parseFloat(trade.price) || 0;
                          const amount = parseFloat(trade.amount) || 0;
                          const realizedPnl = parseFloat(trade.pnl) || 0;
                          const fee = parseFloat(trade.fee) || 0;
                          const tradeValue = price * amount;
                          const timestamp = trade.created_at ? new Date(trade.created_at) : new Date();
                          const sideFormatted = trade.side?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';
                          const isLong = trade.side?.includes('long');
                          const isClose = trade.side?.includes('close');
                          const sideColor = isClose ? (realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400') : (isLong ? 'text-win-400' : 'text-loss-400');
                          const token = trade.symbol?.replace('-USD', '') || '';

                          return (
                            <div key={trade.history_id || index} className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5">
                              {/* Header */}
                              <div className="flex items-center gap-2 mb-2.5">
                                <span className="font-medium text-white text-sm">{token}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${sideColor} ${isClose ? (realizedPnl >= 0 ? 'bg-win-500/20' : 'bg-loss-500/20') : (isLong ? 'bg-win-500/20' : 'bg-loss-500/20')}`}>
                                  {sideFormatted}
                                </span>
                                <span className={`font-mono text-xs font-medium ${realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                                  {realizedPnl >= 0 ? '+' : '-'}${Math.abs(realizedPnl).toFixed(2)}
                                </span>
                              </div>
                              {/* Data grid */}
                              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                                <div>
                                  <div className="text-surface-500">Time</div>
                                  <div className="font-mono text-surface-300">{timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}, {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Side</div>
                                  <div className={`font-medium ${sideColor}`}>{sideFormatted}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Order Type</div>
                                  <div className="text-surface-300">Fulfill Taker</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Size</div>
                                  <div className="font-mono text-white">{amount.toFixed(amount < 0.01 ? 5 : 4)} {token}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Price</div>
                                  <div className="font-mono text-surface-300">{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Trade Value</div>
                                  <div className="font-mono text-surface-300">${tradeValue.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Fees</div>
                                  <div className="font-mono text-surface-300">${fee.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {!showFightOnly && hasMoreTrades && (
                          <div className="p-3 text-center">
                            <button onClick={() => fetchMoreTrades()} disabled={isLoadingMoreTrades} className="text-xs text-surface-300 hover:text-white transition-colors disabled:opacity-50">
                              {isLoadingMoreTrades ? 'Loading...' : 'Load More'}
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Desktop table view */}
                      <div className="overflow-x-auto max-[1199px]:hidden">
                      <table className="w-full text-xs min-w-[800px]">
                        <thead>
                          <tr className="text-xs text-surface-400 tracking-wider">
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'time')}>Time {tradesSort.col === 'time' && (tradesSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'token')}>Token {tradesSort.col === 'token' && (tradesSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'side')}>Side {tradesSort.col === 'side' && (tradesSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Order Type</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'size')}>Size {tradesSort.col === 'size' && (tradesSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'price')}>Price {tradesSort.col === 'price' && (tradesSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'value')}>Trade Value {tradesSort.col === 'value' && (tradesSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'fee')}>Fees {tradesSort.col === 'fee' && (tradesSort.desc ? '↓' : '↑')}</th>
                            <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(tradesSort, setTradesSort, 'pnl')}>Realized PnL {tradesSort.col === 'pnl' && (tradesSort.desc ? '↓' : '↑')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...activeTrades].sort((a: any, b: any) => {
                            const getValue = (trade: any) => {
                              switch (tradesSort.col) {
                                case 'time': return trade.created_at || 0;
                                case 'token': return trade.symbol?.replace('-USD', '') || '';
                                case 'side': return trade.side || '';
                                case 'size': return parseFloat(trade.amount) || 0;
                                case 'price': return parseFloat(trade.price) || 0;
                                case 'value': return (parseFloat(trade.price) || 0) * (parseFloat(trade.amount) || 0);
                                case 'fee': return parseFloat(trade.fee) || 0;
                                case 'pnl': return parseFloat(trade.pnl) || 0;
                                default: return 0;
                              }
                            };
                            const valA = getValue(a);
                            const valB = getValue(b);
                            if (typeof valA === 'string') return tradesSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                            return tradesSort.desc ? valB - valA : valA - valB;
                          }).map((trade: any, index: number) => {
                            const price = parseFloat(trade.price) || 0;
                            const amount = parseFloat(trade.amount) || 0;
                            const realizedPnl = parseFloat(trade.pnl) || 0;
                            const fee = parseFloat(trade.fee) || 0;
                            const tradeValue = price * amount;
                            const timestamp = trade.created_at ? new Date(trade.created_at) : new Date();
                            const sideFormatted = trade.side?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';
                            const isLong = trade.side?.includes('long');
                            const isClose = trade.side?.includes('close');
                            const sideColor = isClose ? (realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400') : (isLong ? 'text-win-400' : 'text-loss-400');
                            const token = trade.symbol?.replace('-USD', '') || '';
                            return (
                              <tr key={trade.history_id || index} className="border-surface-800/50 hover:bg-surface-800/30">
                                <td className="py-2 px-2 text-surface-300 whitespace-nowrap font-mono">{timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
                                <td className="py-2 px-2 text-surface-300">{token}</td>
                                <td className="py-2 px-2"><span className={`font-medium ${sideColor}`}>{sideFormatted}</span></td>
                                <td className="py-2 px-2 text-surface-300">Fulfill Taker</td>
                                <td className="py-2 px-2 font-mono text-surface-300 whitespace-nowrap">{amount.toFixed(amount < 0.01 ? 5 : 4)} {token}</td>
                                <td className="py-2 px-2 font-mono text-surface-300">{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                <td className="py-2 px-2 font-mono text-surface-300">${tradeValue.toFixed(2)}</td>
                                <td className="py-2 px-2 font-mono text-surface-300">${fee.toFixed(2)}</td>
                                <td className="py-2 px-2"><span className={`font-mono ${realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>{realizedPnl >= 0 ? '+' : '-'}${Math.abs(realizedPnl).toFixed(2)}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!showFightOnly && hasMoreTrades && (
                        <div className="p-3 border-t border-surface-800 text-center">
                          <button onClick={() => fetchMoreTrades()} disabled={isLoadingMoreTrades} className="text-xs text-surface-300 hover:text-white transition-colors disabled:opacity-50">{isLoadingMoreTrades ? 'Loading...' : 'Load More'}</button>
                        </div>
                      )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-surface-500 text-xs">
                      {showFightOnly && fightId ? 'No trades during this fight' : 'No trade history'}
                    </div>
                  )
                )}
                {bottomTab === 'history' && (
                  activeOrderHistory.length > 0 ? (
                    <div>
                      {/* Mobile card view for order history */}
                      <div className="max-[1199px]:block hidden space-y-2 px-1">
                        {[...activeOrderHistory].sort((a: any, b: any) => {
                          const getValue = (order: any) => {
                            switch (orderHistorySort.col) {
                              case 'time': return order.created_at || 0;
                              case 'token': return order.symbol || '';
                              case 'side': return order.side || '';
                              case 'type': return order.order_type || '';
                              case 'originalSize': return parseFloat(order.amount) || 0;
                              case 'filledSize': return parseFloat(order.filled_amount) || 0;
                              case 'initialPrice': return parseFloat(order.initial_price || order.stop_price) || 0;
                              case 'avgPrice': return parseFloat(order.average_filled_price) || 0;
                              case 'value': { const f = parseFloat(order.filled_amount) || 0; const p = parseFloat(order.average_filled_price) || 0; return f * p; }
                              case 'status': return order.order_status || '';
                              case 'orderId': return order.order_id || 0;
                              default: return 0;
                            }
                          };
                          const valA = getValue(a);
                          const valB = getValue(b);
                          if (typeof valA === 'string') return orderHistorySort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                          return orderHistorySort.desc ? valB - valA : valA - valB;
                        }).slice(0, 50).map((order: any, index: number) => {
                          const orderSide = order.side === 'bid' ? 'Long' : 'Short';
                          const rawOrderType = order.order_type || 'limit';
                          const orderType = rawOrderType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                          const filledAmount = parseFloat(order.filled_amount || '0');
                          const initialAmount = parseFloat(order.amount || '0');
                          const avgFilledPrice = parseFloat(order.average_filled_price || '0');
                          const stopPrice = parseFloat(order.stop_price || '0');
                          const initialPrice = parseFloat(order.initial_price || '0');
                          const isTpSlOrder = rawOrderType.includes('stop_loss') || rawOrderType.includes('take_profit');
                          const isRegularMarketOrder = rawOrderType === 'market';
                          const orderValue = filledAmount > 0 && avgFilledPrice > 0 ? filledAmount * avgFilledPrice : 0;
                          let status = 'Open';
                          const rawStatus = order.order_status || '';
                          if (rawStatus) {
                            switch (rawStatus.toLowerCase()) {
                              case 'open': status = 'Open'; break;
                              case 'partially_filled': status = 'Partial'; break;
                              case 'filled': status = 'Filled'; break;
                              case 'cancelled': status = 'Cancelled'; break;
                              case 'rejected': status = 'Rejected'; break;
                              default: status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
                            }
                          }
                          const formatHistPrice = (price: number) => {
                            if (price === 0) return 'N/A';
                            if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
                            if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
                            return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
                          };
                          const timestamp = order.created_at ? new Date(order.created_at) : null;

                          return (
                            <div key={order.order_id || index} className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5">
                              {/* Header */}
                              <div className="flex items-center gap-2 mb-2.5">
                                <span className="font-medium text-white text-sm">{order.symbol}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${orderSide === 'Long' ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400'}`}>{orderSide}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-700 text-surface-300">{orderType}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${status === 'Filled' ? 'bg-win-500/20 text-win-400' : status === 'Cancelled' ? 'bg-surface-600/50 text-surface-400' : status === 'Partial' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-surface-500/20 text-surface-300'}`}>{status}</span>
                              </div>
                              {/* Data grid */}
                              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                                <div>
                                  <div className="text-surface-500">Time</div>
                                  <div className="font-mono text-surface-300">{timestamp ? `${timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}, ${timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}` : '-'}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Original Size</div>
                                  <div className="font-mono text-surface-200">{isTpSlOrder ? 'N/A' : `${initialAmount.toFixed(5)} ${order.symbol}`}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Filled Size</div>
                                  <div className="font-mono text-surface-200">{isTpSlOrder ? 'N/A' : `${filledAmount.toFixed(5)} ${order.symbol}`}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Initial Price</div>
                                  <div className="font-mono text-surface-200">{isTpSlOrder ? formatHistPrice(stopPrice) : (isRegularMarketOrder ? 'Market' : formatHistPrice(initialPrice))}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Avg Filled Price</div>
                                  <div className="font-mono text-surface-200">{isTpSlOrder ? 'N/A' : (avgFilledPrice > 0 ? formatHistPrice(avgFilledPrice) : 'N/A')}</div>
                                </div>
                                <div>
                                  <div className="text-surface-500">Order Value</div>
                                  <div className="font-mono text-win-400">{isTpSlOrder ? 'N/A' : (orderValue > 0 ? `$${orderValue.toFixed(2)}` : 'N/A')}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Desktop table view */}
                      <div className="overflow-x-auto max-[1199px]:hidden">
                    <table className="w-full text-xs min-w-[900px]">
                      <thead>
                        <tr className="text-surface-400 text-xs">
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'time')}>Time {orderHistorySort.col === 'time' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'token')}>Token {orderHistorySort.col === 'token' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'side')}>Side {orderHistorySort.col === 'side' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'type')}>Order Type {orderHistorySort.col === 'type' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'originalSize')}>Original Size {orderHistorySort.col === 'originalSize' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'filledSize')}>Filled Size {orderHistorySort.col === 'filledSize' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'initialPrice')}>Initial Price {orderHistorySort.col === 'initialPrice' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'avgPrice')}>Avg Filled Price {orderHistorySort.col === 'avgPrice' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'value')}>Order Value {orderHistorySort.col === 'value' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'status')}>Status {orderHistorySort.col === 'status' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                          <th className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap" onClick={() => toggleSort(orderHistorySort, setOrderHistorySort, 'orderId')}>Order ID {orderHistorySort.col === 'orderId' && (orderHistorySort.desc ? '↓' : '↑')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...activeOrderHistory].sort((a: any, b: any) => {
                          const getValue = (order: any) => {
                            switch (orderHistorySort.col) {
                              case 'time': return order.created_at || 0;
                              case 'token': return order.symbol || '';
                              case 'side': return order.side || '';
                              case 'type': return order.order_type || '';
                              case 'originalSize': return parseFloat(order.amount) || 0;
                              case 'filledSize': return parseFloat(order.filled_amount) || 0;
                              case 'initialPrice': return parseFloat(order.initial_price || order.stop_price) || 0;
                              case 'avgPrice': return parseFloat(order.average_filled_price) || 0;
                              case 'value': { const filled = parseFloat(order.filled_amount) || 0; const avgPrice = parseFloat(order.average_filled_price) || 0; return filled * avgPrice; }
                              case 'status': return order.order_status || '';
                              case 'orderId': return order.order_id || 0;
                              default: return 0;
                            }
                          };
                          const valA = getValue(a);
                          const valB = getValue(b);
                          if (typeof valA === 'string') return orderHistorySort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
                          return orderHistorySort.desc ? valB - valA : valA - valB;
                        }).slice(0, 50).map((order: any, index: number) => {
                          const orderSide = order.side === 'bid' ? 'Long' : 'Short';
                          const rawOrderType = order.order_type || 'limit';
                          const orderType = rawOrderType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                          const filledAmount = parseFloat(order.filled_amount || '0');
                          const initialAmount = parseFloat(order.amount || '0');
                          const avgFilledPrice = parseFloat(order.average_filled_price || '0');
                          const stopPrice = parseFloat(order.stop_price || '0');
                          const initialPrice = parseFloat(order.initial_price || '0');
                          const isTpSlOrder = rawOrderType.includes('stop_loss') || rawOrderType.includes('take_profit');
                          const isRegularMarketOrder = rawOrderType === 'market';
                          const orderValue = filledAmount > 0 && avgFilledPrice > 0 ? filledAmount * avgFilledPrice : 0;
                          let status = 'Open';
                          const rawStatus = order.order_status || '';
                          if (rawStatus) {
                            switch (rawStatus.toLowerCase()) {
                              case 'open': status = 'Open'; break;
                              case 'partially_filled': status = 'Partial'; break;
                              case 'filled': status = 'Filled'; break;
                              case 'cancelled': status = 'Cancelled'; break;
                              case 'rejected': status = 'Rejected'; break;
                              default: status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
                            }
                          }
                          const formatPrice = (price: number) => {
                            if (price === 0) return 'N/A';
                            if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
                            if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
                            return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
                          };
                          return (
                            <tr key={order.order_id || index} className="border-surface-800/50 hover:bg-surface-800/30">
                              <td className="py-2 px-2 text-surface-300 font-mono whitespace-nowrap">{order.created_at ? `${new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}` : '-'}</td>
                              <td className="py-2 px-2 font-medium text-white">{order.symbol}</td>
                              <td className={`py-2 px-2 font-medium ${orderSide === 'Long' ? 'text-win-400' : 'text-loss-400'}`}>{orderSide}</td>
                              <td className="py-2 px-2 text-surface-300">{orderType}</td>
                              <td className="py-2 px-2 font-mono text-surface-200 whitespace-nowrap">{isTpSlOrder ? 'N/A' : `${initialAmount.toFixed(5)} ${order.symbol}`}</td>
                              <td className="py-2 px-2 font-mono text-surface-200 whitespace-nowrap">{isTpSlOrder ? 'N/A' : `${filledAmount.toFixed(5)} ${order.symbol}`}</td>
                              <td className="py-2 px-2 font-mono text-surface-200">{isTpSlOrder ? formatPrice(stopPrice) : (isRegularMarketOrder ? 'Market' : formatPrice(initialPrice))}</td>
                              <td className="py-2 px-2 font-mono text-surface-200">{isTpSlOrder ? 'N/A' : (avgFilledPrice > 0 ? formatPrice(avgFilledPrice) : 'N/A')}</td>
                              <td className="py-2 px-2 font-mono text-win-400">{isTpSlOrder ? 'N/A' : (orderValue > 0 ? `$${orderValue.toFixed(2)}` : 'N/A')}</td>
                              <td className="py-2 px-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${status === 'Filled' ? 'bg-win-500/20 text-win-400' : status === 'Cancelled' ? 'bg-surface-600/50 text-surface-400' : status === 'Triggered' ? 'bg-surface-500/20 text-surface-300' : status === 'Partial' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-surface-500/20 text-surface-300'}`}>{status}</span>
                              </td>
                              <td className="py-2 px-2 font-mono text-surface-400">{order.order_id || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-surface-500 text-xs">
                      {showFightOnly && fightId ? 'No order history during this fight' : 'No order history'}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right: Order Entry (Desktop only — mobile uses bottom sheet) */}
          <div className="col-span-1 order-2 row-span-2 min-h-[1104px] flex flex-col overflow-hidden card" style={{ contain: 'layout' }}>
            <div className="px-4 pt-2 pb-2 flex-shrink-0 border-surface-800">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide">
                  Place Order
                </h3>
                <button
                  onClick={() => { if (canTrade && !hasOpenPosition) setShowMarginModeModal(true); }}
                  disabled={!canTrade || hasOpenPosition}
                  className="flex items-center gap-1 px-2.5 py-1 bg-surface-800 rounded text-[10px] font-medium text-surface-300 hover:text-white hover:bg-surface-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isIsolated ? 'Isolated' : 'Cross'}
                  <svg className="w-2.5 h-2.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-1 flex-1 overflow-y-auto overscroll-y-auto">

              {/* ═══ Warning Banners (top, block trading) ═══ */}

              {/* Pacifica Beta Access Required Warning */}
              {isAuthenticated && !pacificaConnected && pacificaFailReason === 'beta_required' && (
                <div className="mb-3 xl:mb-4 p-2 xl:p-3 bg-orange-500/10 rounded border border-orange-500/30">
                  <div className="text-[10px] xl:text-xs text-orange-400 font-semibold mb-1.5 xl:mb-2 uppercase">Beta Access Required</div>
                  <p className="text-[10px] xl:text-xs text-surface-400 mb-2">
                    Your wallet needs Pacifica beta access. Request a code from Pacifica.
                  </p>
                  <a
                    href="https://pacifica.fi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-semibold rounded transition-colors text-center"
                  >
                    Visit Pacifica
                  </a>
                </div>
              )}
              {/* No Pacifica Account Warning */}
              {isAuthenticated && !pacificaConnected && pacificaFailReason !== 'beta_required' && (
                <div className="mb-3 xl:mb-4 p-2 xl:p-3 bg-surface-800 rounded border-surface-700">
                  <div className="text-[10px] xl:text-xs text-surface-300 font-semibold mb-1.5 xl:mb-2 uppercase">No Pacifica Account</div>
                  <p className="text-[10px] xl:text-xs text-surface-400 mb-2">
                    Deposit funds on Pacifica first to start trading.
                  </p>
                  <a
                    href={PACIFICA_DEPOSIT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-1.5 bg-surface-500 hover:bg-surface-400 text-white text-[10px] font-semibold rounded transition-colors text-center"
                  >
                    Deposit on Pacifica
                  </a>
                </div>
              )}

              {/* Builder Code Authorization Required - One-time approval */}
              {isAuthenticated && pacificaConnected && !isLoadingBuilderCode && !builderCodeApproved && (
                <div className="mb-3 xl:mb-4 p-2 xl:p-3 bg-surface-800 rounded-xl">
                  <div className="text-[10px] xl:text-xs text-surface-300 font-semibold mb-1.5 xl:mb-2 uppercase">Authorization Required</div>
                  <p className="text-[10px] xl:text-xs text-surface-400 mb-1.5">
                    Authorize TFC builder code to trade. One-time approval.
                  </p>
                  <p className="text-[10px] xl:text-xs text-surface-400 mb-2">
                    TFC fee: <span className="text-surface-300 font-semibold">0.05%</span>
                  </p>
                  <button
                    onClick={() => approveBuilderCode.mutate('0.0005')}
                    disabled={approveBuilderCode.isPending}
                    className="w-full py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {approveBuilderCode.isPending ? 'Authorizing...' : 'Authorize Trading'}
                  </button>
                </div>
              )}

              {!canTrade && !isAuthenticated && (
                <div className="mb-3 xl:mb-4 p-2 xl:p-3 bg-surface-800 rounded-lg text-center text-xs xl:text-sm text-surface-400">
                  {!connected ? 'Connect wallet to trade' : 'Authenticating...'}
                </div>
              )}

              {/* ═══ Section A: Trade Form ═══ */}

              {/* Order Type Selector — underline tabs */}
              <div className="mb-3 xl:mb-4 border-b border-surface-800">
                <div className="flex">
                  {(['market', 'limit', 'stop-market', 'stop-limit'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      disabled={!canTrade}
                      className={`relative flex-1 pb-2 text-[10px] xl:text-xs font-medium transition-colors ${
                        orderType === type
                          ? 'text-white'
                          : 'text-surface-500 hover:text-surface-300'
                      } disabled:opacity-50`}
                    >
                      <span className="whitespace-nowrap">{type === 'market' ? 'Market' : type === 'limit' ? 'Limit' : type === 'stop-market' ? 'Stop' : 'Stop Limit'}</span>
                      {orderType === type && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[32px] h-[2px] bg-surface-300 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buy/Long — Sell/Short Toggle */}
              <div className="grid grid-cols-2 gap-0 mb-3 xl:mb-4 border border-surface-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedSide('LONG')}
                  disabled={!canTrade || (reduceOnly && currentMarketPosition?.side === 'LONG')}
                  className={`py-2 xl:py-2.5 font-semibold transition-all text-xs xl:text-sm ${selectedSide === 'LONG'
                    ? 'bg-win-500/15 text-win-400 border-r border-surface-700'
                    : 'bg-transparent text-surface-500 hover:text-surface-300 border-r border-surface-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Buy / Long
                </button>
                <button
                  onClick={() => setSelectedSide('SHORT')}
                  disabled={!canTrade || (reduceOnly && currentMarketPosition?.side === 'SHORT')}
                  className={`py-2 xl:py-2.5 font-semibold transition-all text-xs xl:text-sm ${selectedSide === 'SHORT'
                    ? 'bg-[#e8566d]/15 text-[#e8566d]'
                    : 'bg-transparent text-surface-500 hover:text-surface-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Sell / Short
                </button>
              </div>

              {/* Fight Stake Limit Info - collapsible accordion */}
              {inFight && stake !== null && (
                <div className="mb-3 xl:mb-4 bg-surface-800 rounded border-surface-700 overflow-hidden">
                  <button
                    onClick={() => setShowFightCapital(!showFightCapital)}
                    className="w-full flex items-center justify-between p-2 xl:p-3 hover:bg-surface-700/50 transition-colors"
                  >
                    <span className="text-[10px] xl:text-xs text-surface-300 font-semibold uppercase">Fight Capital</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] xl:text-xs font-mono font-semibold ${(availableStake || 0) > 0 ? 'text-win-400' : 'text-loss-400'}`}>
                        ${(availableStake || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <svg className={`w-3 h-3 text-surface-400 transition-transform ${showFightCapital ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>
                  {showFightCapital && (
                    <div className="px-2 xl:px-3 pb-2 xl:pb-3 space-y-1 xl:space-y-1.5 text-[10px] xl:text-xs">
                      <div className="flex justify-between">
                        <span className="text-surface-400">Fight Stake</span>
                        <span className="text-white font-mono">${stake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Current Positions</span>
                        <span className="text-surface-300 font-mono">${(currentExposure || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Max Capital Used</span>
                        <span className="text-surface-300 font-mono">${(maxExposureUsed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Available to Trade</span>
                        <span className={`font-mono font-semibold ${(availableStake || 0) > 0 ? 'text-win-400' : 'text-loss-400'}`}>
                          ${(availableStake || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="mt-1.5 xl:mt-2">
                        <div className="h-1.5 xl:h-2 bg-surface-700 rounded overflow-hidden">
                          <div
                            className="h-full bg-surface-500 transition-all duration-300"
                            style={{ width: `${Math.min(100, ((maxExposureUsed || 0) / stake) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] xl:text-xs text-surface-500 mt-1">
                          <span>{((maxExposureUsed || 0) / stake * 100).toFixed(0)}% used</span>
                          <span>{(100 - (maxExposureUsed || 0) / stake * 100).toFixed(0)}% available</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Leverage Slider */}
              <div className="mb-3 xl:mb-4">
                <div className="flex justify-between items-center mb-1.5 xl:mb-2">
                  <label className="text-[10px] xl:text-xs font-medium text-surface-400">Leverage</label>
                  <div className="flex items-center gap-1.5 xl:gap-2">
                    <span className="text-[10px] xl:text-xs font-semibold text-surface-300">{Math.min(leverage, maxLeverage)}x</span>
                    {leverage !== savedLeverage && (
                      <button
                        onClick={handleSetLeverage}
                        disabled={!canTrade || setLeverageMutation.isPending}
                        className="px-1.5 xl:px-2 py-0.5 text-[10px] xl:text-xs font-medium bg-surface-500 hover:bg-surface-400 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {setLeverageMutation.isPending ? '...' : 'Set'}
                      </button>
                    )}
                  </div>
                </div>
                {/* Custom slider track */}
                {(() => {
                  const currentLev = Math.min(leverage, maxLeverage);
                  const percent = ((currentLev - 1) / (maxLeverage - 1)) * 100;
                  const ticks = [0, 25, 50, 75, 100];
                  return (
                    <div
                      className={`relative w-full h-8 flex items-center select-none touch-none ${!canTrade ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                      onPointerDown={(e) => {
                        if (!canTrade) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pad = 9;
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / (rect.width - pad * 2)));
                        setLeverage(Math.max(1, Math.min(maxLeverage, Math.round(1 + pct * (maxLeverage - 1)))));
                      }}
                      onPointerMove={(e) => {
                        if (!canTrade || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pad = 9;
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / (rect.width - pad * 2)));
                        setLeverage(Math.max(1, Math.min(maxLeverage, Math.round(1 + pct * (maxLeverage - 1)))));
                      }}
                    >
                      {/* Track bg */}
                      <div className="absolute left-[9px] right-[9px] h-[3px] bg-surface-700 rounded-full" />
                      {/* Filled portion */}
                      <div className="absolute left-[9px] h-[3px] bg-surface-400 rounded-full" style={{ width: `calc(${percent / 100} * (100% - 18px))` }} />
                      {/* Tick dots */}
                      {ticks.map((t) => (
                        <div
                          key={t}
                          className={`absolute w-2 h-2 rounded-full -translate-x-1/2 ${t <= percent ? 'bg-surface-400' : 'bg-surface-600'}`}
                          style={{ left: `calc(9px + ${t / 100} * (100% - 18px))` }}
                        />
                      ))}
                      {/* Thumb — ring style */}
                      <div
                        className="absolute w-[18px] h-[18px] rounded-full -translate-x-1/2 bg-surface-400 shadow-lg shadow-surface-400/30"
                        style={{ left: `calc(9px + ${percent / 100} * (100% - 18px))` }}
                      >
                        <div className="absolute inset-[3px] rounded-full bg-surface-900" />
                        <div className="absolute inset-[5px] rounded-full bg-surface-300" />
                      </div>
                    </div>
                  );
                })()}
                <div className="flex justify-between text-[10px] xl:text-xs text-surface-500 mt-1">
                  <span>1x</span>
                  <span>{Math.floor(maxLeverage / 2)}x</span>
                  <span>{maxLeverage}x</span>
                </div>
                {leverage !== savedLeverage && canTrade && (
                  <p className="text-[10px] xl:text-xs text-yellow-400 mt-1.5">
                    Confirm leverage change with <span className="font-semibold">Set</span>
                  </p>
                )}
              </div>

              {/* Price Inputs - Show for non-market orders */}
              {orderType !== 'market' && (
                <div className="mb-3 xl:mb-4 space-y-2 xl:space-y-3">
                  {/* Trigger Price - for stop orders */}
                  {(orderType === 'stop-market' || orderType === 'stop-limit') && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                        <label className="text-[10px] xl:text-xs font-medium text-surface-400">
                          Trigger Price
                        </label>
                        <button
                          onClick={() => setTriggerPrice(currentPrice.toFixed(2))}
                          disabled={!canTrade}
                          className="text-[10px] xl:text-xs font-medium text-surface-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Mid
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={triggerPrice}
                          onChange={(e) => setTriggerPrice(e.target.value)}
                          placeholder={selectedSide === 'LONG' ? `> ${currentPrice.toFixed(2)}` : `< ${currentPrice.toFixed(2)}`}
                          disabled={!canTrade}
                          className="input text-xs xl:text-sm w-full pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] xl:text-xs text-surface-400">
                          USD
                        </span>
                      </div>
                      <p className="text-[9px] xl:text-[10px] text-surface-500 mt-0.5">
                        {selectedSide === 'LONG'
                          ? 'Triggers when price rises above this level'
                          : 'Triggers when price drops below this level'}
                      </p>
                    </div>
                  )}

                  {/* Limit Price - for limit and stop-limit orders */}
                  {(orderType === 'limit' || orderType === 'stop-limit') && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                        <label className="text-[10px] xl:text-xs font-medium text-surface-400">
                          {orderType === 'stop-limit' ? 'Limit Price' : 'Price'}
                        </label>
                        <button
                          onClick={() => setLimitPrice(currentPrice.toFixed(2))}
                          disabled={!canTrade}
                          className="text-[10px] xl:text-xs font-medium text-surface-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Mid
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(e.target.value)}
                          placeholder={currentPrice.toFixed(2)}
                          disabled={!canTrade}
                          className="input text-xs xl:text-sm w-full pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] xl:text-xs text-surface-400">
                          USD
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Size Input */}
              <div className="mb-3 xl:mb-4">
                <label className="block text-[10px] xl:text-xs font-medium text-surface-400 mb-1.5 xl:mb-2">
                  Size
                </label>
                {(() => {
                  const effectiveLeverage = Math.min(leverage, maxLeverage);
                  const available = account ? parseFloat(account.availableToSpend) : 0;
                  // Margin buffer: use 95% of available to maintain margin for fees/slippage
                  const MARGIN_BUFFER = 0.95;

                  // For reduce_only: max is based on the opposite position size (what can be closed)
                  const closeablePosition = reduceOnly
                    ? displayPositions.find(
                        p => p.symbol.replace('-USD', '') === selectedMarket.replace('-USD', '') &&
                             p.side === (selectedSide === 'LONG' ? 'SHORT' : 'LONG')
                      )
                    : null;
                  const maxMargin = reduceOnly
                    ? (closeablePosition ? closeablePosition.margin : 0)
                    : available * MARGIN_BUFFER;
                  const margin = parseFloat(orderSize || '0');
                  const positionSize = margin * effectiveLeverage;
                  const tokenAmount = currentPrice > 0 ? positionSize / currentPrice : 0;

                  return (
                    <>
                      {/* Token and USD inputs - stacked on mobile, side by side on desktop */}
                      <div className="flex flex-col xl:flex-row gap-1.5 xl:gap-2 mb-1.5 xl:mb-2">
                        {/* Token amount input (position size in tokens) */}
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={tokenAmount > 0 ? tokenAmount.toFixed(5) : ''}
                            onChange={(e) => {
                              const newTokenAmount = parseFloat(e.target.value) || 0;
                              // Calculate margin from token amount: margin = (tokens * price) / leverage
                              const newMargin = (newTokenAmount * currentPrice) / effectiveLeverage;
                              setOrderSize(newMargin.toFixed(2));
                            }}
                            className="input text-xs xl:text-sm w-full pr-10 xl:pr-12"
                            placeholder="0.00"
                            disabled={!canTrade}
                          />
                          <span className="absolute right-2 xl:right-3 top-1/2 -translate-y-1/2 text-[10px] xl:text-xs text-surface-300 font-medium">
                            {selectedMarket.replace('-USD', '')}
                          </span>
                        </div>
                        {/* USD position size display (leveraged amount) */}
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={positionSize > 0 ? positionSize.toFixed(2) : ''}
                            onChange={(e) => {
                              const newPositionSize = parseFloat(e.target.value) || 0;
                              // Calculate margin from position size: margin = positionSize / leverage
                              const newMargin = newPositionSize / effectiveLeverage;
                              setOrderSize(newMargin.toFixed(2));
                            }}
                            className="input text-xs xl:text-sm w-full pr-10 xl:pr-12"
                            placeholder="0.00"
                            disabled={!canTrade}
                          />
                          <span className="absolute right-2 xl:right-3 top-1/2 -translate-y-1/2 text-[10px] xl:text-xs text-surface-400 font-medium">
                            USD
                          </span>
                        </div>
                      </div>
                      {/* Margin indicator - stacked on mobile, side by side on desktop */}
                      <div className="text-[10px] xl:text-xs text-surface-500 mb-1.5 xl:mb-2 flex flex-col xl:flex-row xl:justify-between">
                        <span>Margin: ${margin.toFixed(2)}</span>
                        <span>Max: ${maxMargin.toFixed(2)} ({effectiveLeverage}x)</span>
                      </div>
                      {/* Percentage slider */}
                      {(() => {
                        const pct = maxMargin > 0 ? Math.min(100, Math.round((margin / maxMargin) * 100)) : 0;
                        const ticks = [0, 25, 50, 75, 100];
                        return (
                          <div
                            className={`relative w-full h-8 flex items-center select-none touch-none ${!canTrade ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                            onPointerDown={(e) => {
                              if (!canTrade) return;
                              e.currentTarget.setPointerCapture(e.pointerId);
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pad = 9;
                              const p = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left - pad) / (rect.width - pad * 2)) * 100)));
                              setOrderSize((maxMargin * p / 100).toFixed(2));
                            }}
                            onPointerMove={(e) => {
                              if (!canTrade || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pad = 9;
                              const p = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left - pad) / (rect.width - pad * 2)) * 100)));
                              setOrderSize((maxMargin * p / 100).toFixed(2));
                            }}
                          >
                            <div className="absolute left-[9px] right-[9px] h-[3px] bg-surface-700 rounded-full" />
                            <div className="absolute left-[9px] h-[3px] bg-surface-400 rounded-full" style={{ width: `calc(${pct / 100} * (100% - 18px))` }} />
                            {ticks.map((t) => (
                              <div
                                key={t}
                                className={`absolute w-2 h-2 rounded-full -translate-x-1/2 ${t <= pct ? 'bg-surface-400' : 'bg-surface-600'}`}
                                style={{ left: `calc(9px + ${t / 100} * (100% - 18px))` }}
                              />
                            ))}
                            <div
                              className="absolute w-[18px] h-[18px] rounded-full -translate-x-1/2 bg-surface-400 shadow-lg shadow-surface-400/30"
                              style={{ left: `calc(9px + ${pct / 100} * (100% - 18px))` }}
                            >
                              <div className="absolute inset-[3px] rounded-full bg-surface-900" />
                              <div className="absolute inset-[5px] rounded-full bg-surface-300" />
                            </div>
                          </div>
                        );
                      })()}
                      {/* Percentage buttons */}
                      <div className="flex gap-1.5 xl:gap-2 mt-1.5 xl:mt-2">
                        {[25, 50, 75, 100].map((percent) => {
                          const currentPercent = maxMargin > 0
                            ? Math.round((margin / maxMargin) * 100)
                            : 0;
                          const isSelected = Math.abs(currentPercent - percent) <= 2;

                          return (
                            <button
                              key={percent}
                              onClick={() => {
                                const newMargin = (maxMargin * percent / 100).toFixed(2);
                                setOrderSize(newMargin);
                              }}
                              disabled={!canTrade}
                              className={`flex-1 py-1 xl:py-1.5 text-[10px] xl:text-xs font-medium rounded transition-colors disabled:opacity-50 ${isSelected
                                ? 'bg-surface-600 text-white border border-surface-500'
                                : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white border border-transparent'
                                }`}
                            >
                              {percent}%
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>


              {/* Reduce Only toggle — above TP/SL */}
              <div className="mb-3 xl:mb-4">
                <Toggle
                  checked={reduceOnly}
                  onChange={(checked) => {
                    setReduceOnly(checked);
                    // Disable TP/SL when reduce only is enabled
                    if (checked) {
                      setTpEnabled(false);
                      setSlEnabled(false);
                      setTakeProfit('');
                      setStopLoss('');
                    }
                  }}
                  disabled={!canTrade}
                  label="Reduce Only"
                />
              </div>

              {/* Take Profit / Stop Loss - For Market and Limit orders, disabled when Reduce Only */}
              {(orderType === 'market' || orderType === 'limit') && !reduceOnly && (
                <div className="mb-3 xl:mb-4 space-y-2 xl:space-y-3">
                  {/* TP/SL Toggle Header */}
                  <Toggle
                    checked={tpEnabled || slEnabled}
                    onChange={(checked) => {
                      setTpEnabled(checked);
                      setSlEnabled(checked);
                    }}
                    disabled={!canTrade}
                    label="Take Profit / Stop Loss"
                  />

                  {(tpEnabled || slEnabled) && (() => {
                    // Reference price for percentage calculations
                    const refPrice = orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice;
                    const effectiveLev = Math.min(leverage, maxLeverage);

                    // Round price to tick size (Pacifica requires prices to be multiples of tick size)
                    const roundToTickSize = (price: number) => {
                      const rounded = Math.round(price / tickSize) * tickSize;
                      // Determine decimal places from tick size
                      const decimals = tickSize >= 1 ? 0 : Math.ceil(-Math.log10(tickSize));
                      return rounded.toFixed(decimals);
                    };

                    // Calculate TP price from percentage gain
                    const calcTpPrice = (gainPercent: number) => {
                      const priceMove = (gainPercent / 100 / effectiveLev) * refPrice;
                      const rawPrice = selectedSide === 'LONG'
                        ? refPrice + priceMove
                        : refPrice - priceMove;
                      return roundToTickSize(rawPrice);
                    };

                    // Calculate SL price from percentage loss
                    const calcSlPrice = (lossPercent: number) => {
                      const priceMove = (Math.abs(lossPercent) / 100 / effectiveLev) * refPrice;
                      const rawPrice = selectedSide === 'LONG'
                        ? refPrice - priceMove
                        : refPrice + priceMove;
                      return roundToTickSize(rawPrice);
                    };

                    return (
                      <>
                        {/* Take Profit */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                            <span className="text-[10px] xl:text-xs font-medium text-surface-300">TP Price</span>
                            {takeProfit && (
                              <span className="text-[10px] xl:text-xs text-surface-400">
                                {selectedSide === 'LONG'
                                  ? `+${(((parseFloat(takeProfit) - refPrice) / refPrice) * 100 * effectiveLev).toFixed(1)}%`
                                  : `+${(((refPrice - parseFloat(takeProfit)) / refPrice) * 100 * effectiveLev).toFixed(1)}%`
                                }
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={takeProfit}
                            onChange={(e) => setTakeProfit(e.target.value)}
                            placeholder={selectedSide === 'LONG' ? `> ${roundToTickSize(refPrice)}` : `< ${roundToTickSize(refPrice)}`}
                            disabled={!canTrade}
                            className="input text-xs xl:text-sm w-full mb-1.5 xl:mb-2"
                          />
                          {/* TP Percentage Buttons */}
                          <div className="flex gap-1">
                            {[25, 50, 75, 100].map((pct) => (
                              <button
                                key={pct}
                                onClick={() => setTakeProfit(calcTpPrice(pct))}
                                disabled={!canTrade}
                                className="flex-1 py-0.5 xl:py-1 text-[10px] xl:text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 rounded transition-colors disabled:opacity-50"
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Stop Loss */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                            <span className="text-[10px] xl:text-xs font-medium text-surface-300">SL Price</span>
                            {stopLoss && (
                              <span className="text-[10px] xl:text-xs text-surface-400">
                                {selectedSide === 'LONG'
                                  ? `-${(((refPrice - parseFloat(stopLoss)) / refPrice) * 100 * effectiveLev).toFixed(1)}%`
                                  : `-${(((parseFloat(stopLoss) - refPrice) / refPrice) * 100 * effectiveLev).toFixed(1)}%`
                                }
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={stopLoss}
                            onChange={(e) => setStopLoss(e.target.value)}
                            placeholder={selectedSide === 'LONG' ? `< ${roundToTickSize(refPrice)}` : `> ${roundToTickSize(refPrice)}`}
                            disabled={!canTrade}
                            className="input text-xs xl:text-sm w-full mb-1.5 xl:mb-2"
                          />
                          {/* SL Percentage Buttons */}
                          <div className="flex gap-1">
                            {[-25, -50, -75, -100].map((pct) => (
                              <button
                                key={pct}
                                onClick={() => setStopLoss(calcSlPrice(pct))}
                                disabled={!canTrade}
                                className="flex-1 py-0.5 xl:py-1 text-[10px] xl:text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 rounded transition-colors disabled:opacity-50"
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Order Preview — compact (no redundant Order Type row) */}
              {(() => {
                const effectiveLeverage = Math.min(leverage, maxLeverage);
                const positionSize = Number(orderSize) * effectiveLeverage;
                const orderMargin = Number(orderSize) || 0;

                // Find current position for selected market
                const mktSymbol = selectedMarket.replace('-USD', '');
                const currentPos = displayPositions.find(
                  p => p.symbol.replace('-USD', '') === mktSymbol
                );

                // For reduce_only: show closeable position size instead of available margin
                const closeablePos = reduceOnly
                  ? displayPositions.find(
                      p => p.symbol.replace('-USD', '') === mktSymbol &&
                           p.side === (selectedSide === 'LONG' ? 'SHORT' : 'LONG')
                    )
                  : null;
                const available = reduceOnly
                  ? (closeablePos ? closeablePos.margin : 0)
                  : (account ? parseFloat(account.availableToSpend) || 0 : 0);

                // For limit orders, use limit price; for market, use current price
                const executionPrice = orderType === 'limit' || orderType === 'stop-limit'
                  ? parseFloat(limitPrice) || currentPrice
                  : currentPrice;

                // Estimated liquidation price for new order (simplified)
                const estLiqPrice = positionSize > 0
                  ? executionPrice * (selectedSide === 'LONG'
                    ? 1 - (1 / effectiveLeverage) * 0.9
                    : 1 + (1 / effectiveLeverage) * 0.9)
                  : 0;

                const hasOrder = positionSize > 0;
                const hasPosition = !!currentPos && currentPos.liquidationPrice > 0;

                // Liq Price: show arrow "current -> new" when both exist
                let liqPriceDisplay: string;
                if (hasOrder && hasPosition) {
                  liqPriceDisplay = `$${formatPrice(currentPos.liquidationPrice)} → $${formatPrice(estLiqPrice)}`;
                } else if (hasOrder) {
                  liqPriceDisplay = `$${formatPrice(estLiqPrice)}`;
                } else if (hasPosition) {
                  liqPriceDisplay = `$${formatPrice(currentPos.liquidationPrice)}`;
                } else {
                  liqPriceDisplay = 'N/A';
                }

                // Margin: show arrow "current -> new" when both exist
                let marginDisplay: string;
                if (hasOrder && hasPosition) {
                  marginDisplay = `$${currentPos.margin.toFixed(2)} → $${(currentPos.margin + orderMargin).toFixed(2)}`;
                } else if (hasOrder) {
                  marginDisplay = `$${orderMargin.toFixed(2)}`;
                } else if (hasPosition) {
                  marginDisplay = `$${currentPos.margin.toFixed(2)}`;
                } else {
                  marginDisplay = 'N/A';
                }

                return (
                  <div className="text-[10px] xl:text-xs space-y-1 xl:space-y-1.5 mb-3 xl:mb-4">
                    {orderType === 'market' && (
                      <div className="flex justify-between">
                        <span className="text-surface-400">Max Slippage</span>
                        <button
                          onClick={() => { setSlippageInput(slippage); setShowSlippageModal(true); }}
                          disabled={!isAuthenticated}
                          className={`font-mono ${isAuthenticated ? 'text-surface-300 hover:text-white underline decoration-dotted cursor-pointer' : 'text-surface-500 cursor-not-allowed'}`}
                        >
                          {slippage}%
                        </button>
                      </div>
                    )}
                    {(orderType === 'limit' || orderType === 'stop-limit') && limitPrice && (
                      <div className="flex justify-between">
                        <span className="text-surface-400">Limit Price</span>
                        <span className="text-white font-mono">${parseFloat(limitPrice).toLocaleString()}</span>
                      </div>
                    )}
                    {(orderType === 'stop-market' || orderType === 'stop-limit') && triggerPrice && (
                      <div className="flex justify-between">
                        <span className="text-surface-400">Trigger Price</span>
                        <span className="text-white font-mono">${parseFloat(triggerPrice).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-surface-400">Est. Liq Price</span>
                      <span className="text-white font-mono">{liqPriceDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Margin</span>
                      <span className="text-white font-mono">{marginDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Available</span>
                      <span className="text-white font-mono">
                        {`$${available.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                );
              })()}


              {/* Blocked symbol warning */}
              {isSymbolBlocked && (
                <div className="mb-2 xl:mb-3 p-1.5 xl:p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] xl:text-xs text-amber-400 text-center">
                  {selectedMarket.replace('-USD', '')} is blocked - you had a position before the fight started
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={!canTrade || createMarketOrder.isPending || createLimitOrder.isPending || createStandaloneStopOrder.isPending || leverage !== savedLeverage || isSymbolBlocked}
                className={`w-full py-2.5 xl:py-3 rounded-lg font-bold text-xs xl:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${selectedSide === 'LONG'
                  ? 'bg-win-500 hover:bg-win-400 text-white'
                  : 'bg-[#e8566d] hover:bg-[#ec6b7e] text-white'
                  }`}
              >
                {isSymbolBlocked
                  ? 'Symbol Blocked'
                  : (createMarketOrder.isPending || createLimitOrder.isPending || createStandaloneStopOrder.isPending)
                    ? 'Placing Order...'
                    : (() => {
                      const orderTypeLabel = orderType === 'market' ? '' :
                        orderType === 'limit' ? ' Limit' :
                          orderType === 'stop-market' ? ' Stop' :
                            ' Stop Limit';
                      return selectedSide === 'LONG'
                        ? `Buy / Long${orderTypeLabel}`
                        : `Sell / Short${orderTypeLabel}`;
                    })()}
              </button>

              {/* ═══ Section B: Account Info (below submit) ═══ */}

              {/* Deposit/Withdraw buttons */}
              {isAuthenticated && pacificaConnected && account && (
                <div className="flex gap-1.5 xl:gap-2 mt-3 xl:mt-4">
                  <a
                    href="https://app.pacifica.fi?referral=TFC"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 xl:gap-1.5 py-1 xl:py-2 text-[10px] xl:text-sm font-medium bg-surface-700 hover:bg-surface-600 text-surface-200 hover:text-white rounded-lg transition-colors"
                  >
                    <FileDownloadIcon sx={{ fontSize: 12 }} className="text-surface-400 xl:text-base" />
                    Deposit
                  </a>
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="flex-1 flex items-center justify-center gap-1 xl:gap-1.5 py-1 xl:py-2 text-[10px] xl:text-sm font-medium bg-surface-700 hover:bg-surface-600 text-surface-200 hover:text-white rounded-lg transition-colors"
                  >
                    <FileUploadIcon sx={{ fontSize: 12 }} className="text-surface-400 xl:text-base" />
                    Withdraw
                  </button>
                </div>
              )}

              {/* Account Stats — collapsible */}
              {isAuthenticated && pacificaConnected && account && (() => {
                // Dynamic fees from Pacifica API (change monthly, not hardcoded)
                const pacificaTakerFee = parseFloat(account.takerFee || '0.0007'); // Default fallback
                const pacificaMakerFee = parseFloat(account.makerFee || '0.000575'); // Default fallback
                const takerFeePercent = ((pacificaTakerFee + TRADECLUB_FEE) * 100).toFixed(4);
                const makerFeePercent = ((pacificaMakerFee + TRADECLUB_FEE) * 100).toFixed(4);

                const equity = parseFloat(account.accountEquity) || 0;
                const marginUsed = parseFloat(account.totalMarginUsed) || 0;
                const available = parseFloat(account.availableToSpend) || 0;
                const restingOrderValue = Math.max(0, equity - marginUsed - available - realtimeUnrealizedPnl);

                // Cross account leverage = total position value / equity
                const totalPositionValue = displayPositions.reduce((sum, p) => sum + p.size, 0);
                const crossAccountLeverage = equity > 0 ? totalPositionValue / equity : 0;

                // Maintenance margin from API
                const maintenanceMargin = parseFloat(account.crossMmr || '0') || marginUsed * 0.5;

                return (
                  <div className="mt-3 xl:mt-4 border-t border-surface-800">
                    <button
                      onClick={() => setShowAccountStats(!showAccountStats)}
                      className="w-full flex items-center justify-between py-2 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                    >
                      <span className="font-medium">Account Info</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white">${equity.toFixed(2)}</span>
                        <svg className={`w-3.5 h-3.5 transition-transform ${showAccountStats ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {showAccountStats && (
                      <div className="pb-3 space-y-1 xl:space-y-1.5 text-[10px] xl:text-xs">
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Account Equity</span>
                          <span className="text-white font-mono">${equity.toFixed(2)}</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            Total account value including unrealized PnL and margin used
                          </div>
                        </div>
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Idle Balance</span>
                          <span className="text-white font-mono">${available.toFixed(2)}</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            Available balance not used in positions or orders
                          </div>
                        </div>
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Resting Order Value</span>
                          <span className="text-white font-mono">${restingOrderValue.toFixed(2)}</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            Total value locked in open limit orders
                          </div>
                        </div>
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Fees</span>
                          <span className="text-white font-mono">{takerFeePercent}% / {makerFeePercent}%</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            Trading fees: Taker (market orders) / Maker (limit orders). Includes 0.05% TradeFightClub fee
                          </div>
                        </div>
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Unrealized PnL</span>
                          <span className={`font-mono ${realtimeUnrealizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                            {realtimeUnrealizedPnl >= 0 ? '+' : '-'}${Math.abs(realtimeUnrealizedPnl).toFixed(2)}
                          </span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            Profit or loss from open positions at current mark price
                          </div>
                        </div>
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Cross Account Leverage</span>
                          <span className="text-white font-mono">{crossAccountLeverage.toFixed(2)}x</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            Overall leverage across all positions in cross margin mode. Higher values indicate more risk
                          </div>
                        </div>
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Maintenance Margin</span>
                          <span className="text-white font-mono">${maintenanceMargin.toFixed(2)}</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            Minimum margin required to keep positions open. Liquidation occurs if equity falls below this
                          </div>
                        </div>
                        <div className="flex justify-between group relative">
                          <span className="text-surface-400 cursor-help border-b border-dotted border-surface-600">Real-time Updates</span>
                          <span className={`font-mono flex items-center gap-1.5 ${pacificaWsConnected ? 'text-win-400' : 'text-surface-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pacificaWsConnected ? 'bg-win-400 animate-pulse' : 'bg-surface-500'}`} />
                            {pacificaWsConnected ? 'Live' : 'Polling'}
                          </span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 p-2 bg-surface-900 border border-surface-600 rounded text-xs text-surface-300 shadow-lg">
                            {pacificaWsConnected
                              ? 'Connected to Pacifica WebSocket for instant position and order updates'
                              : 'Using HTTP polling for updates (every 10 seconds). WebSocket connection not available.'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Challenge CTA */}
              <div className="mt-3 xl:mt-4 pt-3 xl:pt-4 border-t border-surface-800">
                {isAuthenticated ? (
                  <Link
                    href="/lobby"
                    className="block text-center py-2.5 xl:py-3 bg-surface-500/10 hover:bg-surface-500/20 rounded-lg text-surface-300 text-xs xl:text-sm font-semibold transition-colors"
                  >
                    Challenge a Trader
                  </Link>
                ) : (
                  <div className="block text-center py-2.5 xl:py-3 bg-surface-800/50 rounded-lg text-surface-500 text-xs xl:text-sm font-semibold cursor-not-allowed">
                    Challenge a Trader
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Mobile Sticky Buy/Sell Buttons (CEX-style) ═══ */}
      <div className="xl:hidden fixed bottom-14 left-0 right-0 z-40 bg-surface-900 border-surface-800 px-3 py-2 flex gap-3">
        <button
          onClick={() => { setSelectedSide('LONG'); setShowOrderSheet(true); }}
          className="flex-1 py-3 rounded-lg bg-win-500 hover:bg-win-400 text-white font-bold text-sm transition-colors"
        >
          Buy / Long
        </button>
        <button
          onClick={() => { setSelectedSide('SHORT'); setShowOrderSheet(true); }}
          className="flex-1 py-3 rounded-lg bg-[#e8566d] hover:bg-[#ec6b7e] text-white font-bold text-sm transition-colors"
        >
          Sell / Short
        </button>
      </div>

      {/* ═══ Mobile Order Form Bottom Sheet ═══ */}
      {showOrderSheet && (
        <div className="xl:hidden fixed inset-0 z-[70]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 transition-opacity duration-500"
            style={{ opacity: orderSheetVisible ? 1 : 0 }}
            onClick={closeOrderSheet}
          />
          {/* Sheet wrapper — handles transform animation */}
          <div
            className="absolute left-0 right-0 bottom-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: orderSheetVisible ? 'translateY(0)' : 'translateY(100%)' }}
          >
          {/* Sheet content — handles scroll */}
          <div className="bg-surface-900 rounded-t-2xl max-h-[85vh] overflow-y-auto pb-4">
            {/* Drag handle + header */}
            <div className="sticky top-0 bg-surface-900 pt-3 pb-2 z-10 rounded-t-2xl">
              <div className="flex justify-center mb-2">
                <div className="w-10 h-1 bg-surface-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-display font-semibold text-sm text-white uppercase tracking-wide">Place Order</h3>
                  <button
                    onClick={() => { if (canTrade && !hasOpenPosition) setShowMarginModeModal(true); }}
                    disabled={!canTrade || hasOpenPosition}
                    className="flex items-center gap-1 px-2.5 py-1 bg-surface-800 rounded text-[10px] font-medium text-surface-300 hover:text-white hover:bg-surface-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isIsolated ? 'Isolated' : 'Cross'}
                    <svg className="w-3 h-3 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={closeOrderSheet}
                  className="p-1.5 rounded hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Order form content */}
            <div className="px-4 pb-8">
              {/* Warning Banners */}
              {isAuthenticated && !pacificaConnected && pacificaFailReason === 'beta_required' && (
                <div className="mb-3 p-3 bg-orange-500/10 rounded border border-orange-500/30">
                  <div className="text-xs text-orange-400 font-semibold mb-2 uppercase">Beta Access Required</div>
                  <p className="text-xs text-surface-400 mb-2">Your wallet needs Pacifica beta access.</p>
                  <a href="https://pacifica.fi" target="_blank" rel="noopener noreferrer" className="block w-full py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded transition-colors text-center">Visit Pacifica</a>
                </div>
              )}
              {isAuthenticated && !pacificaConnected && pacificaFailReason !== 'beta_required' && (
                <div className="mb-3 p-3 bg-surface-800 rounded border-surface-700">
                  <div className="text-xs text-surface-300 font-semibold mb-2 uppercase">No Pacifica Account</div>
                  <p className="text-xs text-surface-400 mb-2">Deposit funds on Pacifica first.</p>
                  <a href={PACIFICA_DEPOSIT_URL} target="_blank" rel="noopener noreferrer" className="block w-full py-2 bg-surface-500 hover:bg-surface-400 text-white text-xs font-semibold rounded transition-colors text-center">Deposit on Pacifica</a>
                </div>
              )}
              {isAuthenticated && pacificaConnected && !isLoadingBuilderCode && !builderCodeApproved && (
                <div className="mb-3 p-3 bg-surface-800 rounded-xl">
                  <div className="text-xs text-surface-300 font-semibold mb-2 uppercase">Authorization Required</div>
                  <p className="text-xs text-surface-400 mb-1.5">Authorize TFC builder code. One-time approval.</p>
                  <p className="text-xs text-surface-400 mb-2">TFC fee: <span className="text-surface-300 font-semibold">0.05%</span></p>
                  <button onClick={() => approveBuilderCode.mutate('0.0005')} disabled={approveBuilderCode.isPending} className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {approveBuilderCode.isPending ? 'Authorizing...' : 'Authorize Trading'}
                  </button>
                </div>
              )}
              {!canTrade && !isAuthenticated && (
                <div className="mb-3 p-3 bg-surface-800 rounded-lg text-center text-sm text-surface-400">
                  {!connected ? 'Connect wallet to trade' : 'Authenticating...'}
                </div>
              )}

              {/* Order Type Selector */}
              <div className="mb-4 border-b border-surface-800">
                <div className="flex">
                  {(['market', 'limit', 'stop-market', 'stop-limit'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      disabled={!canTrade}
                      className={`relative flex-1 pb-2.5 text-xs font-medium transition-colors ${
                        orderType === type ? 'text-white' : 'text-surface-500 hover:text-surface-300'
                      } disabled:opacity-50`}
                    >
                      <span className="whitespace-nowrap">{type === 'market' ? 'Market' : type === 'limit' ? 'Limit' : type === 'stop-market' ? 'Stop' : 'Stop Limit'}</span>
                      {orderType === type && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[32px] h-[2px] bg-surface-300 rounded-full" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buy/Long — Sell/Short Toggle */}
              <div className="grid grid-cols-2 gap-0 mb-4 border border-surface-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedSide('LONG')}
                  disabled={!canTrade || (reduceOnly && currentMarketPosition?.side === 'LONG')}
                  className={`py-2.5 font-semibold transition-all text-sm ${selectedSide === 'LONG'
                    ? 'bg-win-500/15 text-win-400 border-r border-surface-700'
                    : 'bg-transparent text-surface-500 hover:text-surface-300 border-r border-surface-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Buy / Long
                </button>
                <button
                  onClick={() => setSelectedSide('SHORT')}
                  disabled={!canTrade || (reduceOnly && currentMarketPosition?.side === 'SHORT')}
                  className={`py-2.5 font-semibold transition-all text-sm ${selectedSide === 'SHORT'
                    ? 'bg-[#e8566d]/15 text-[#e8566d]'
                    : 'bg-transparent text-surface-500 hover:text-surface-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Sell / Short
                </button>
              </div>

              {/* Fight Stake Limit Info */}
              {inFight && stake !== null && (
                <div className="mb-4 bg-surface-800 rounded border-surface-700 overflow-hidden">
                  <button
                    onClick={() => setShowFightCapital(!showFightCapital)}
                    className="w-full flex items-center justify-between p-3 hover:bg-surface-700/50 transition-colors"
                  >
                    <span className="text-xs text-surface-300 font-semibold uppercase">Fight Capital</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-semibold ${(availableStake || 0) > 0 ? 'text-win-400' : 'text-loss-400'}`}>
                        ${(availableStake || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <svg className={`w-3 h-3 text-surface-400 transition-transform ${showFightCapital ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>
                  {showFightCapital && (
                    <div className="px-3 pb-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-surface-400">Fight Stake</span>
                        <span className="text-white font-mono">${stake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Current Positions</span>
                        <span className="text-surface-300 font-mono">${(currentExposure || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Max Capital Used</span>
                        <span className="text-surface-300 font-mono">${(maxExposureUsed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400">Available to Trade</span>
                        <span className={`font-mono font-semibold ${(availableStake || 0) > 0 ? 'text-win-400' : 'text-loss-400'}`}>
                          ${(availableStake || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="h-2 bg-surface-700 rounded overflow-hidden">
                          <div className="h-full bg-surface-500 transition-all duration-300" style={{ width: `${Math.min(100, ((maxExposureUsed || 0) / stake) * 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-surface-500 mt-1">
                          <span>{((maxExposureUsed || 0) / stake * 100).toFixed(0)}% used</span>
                          <span>{(100 - (maxExposureUsed || 0) / stake * 100).toFixed(0)}% available</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Leverage Slider */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-surface-400">Leverage</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-surface-300">{Math.min(leverage, maxLeverage)}x</span>
                    {leverage !== savedLeverage && (
                      <button
                        onClick={handleSetLeverage}
                        disabled={!canTrade || setLeverageMutation.isPending}
                        className="px-2 py-0.5 text-xs font-medium bg-surface-500 hover:bg-surface-400 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {setLeverageMutation.isPending ? '...' : 'Set'}
                      </button>
                    )}
                  </div>
                </div>
                {(() => {
                  const currentLev = Math.min(leverage, maxLeverage);
                  const percent = ((currentLev - 1) / (maxLeverage - 1)) * 100;
                  const ticks = [0, 25, 50, 75, 100];
                  return (
                    <div
                      className={`relative w-full h-8 flex items-center select-none touch-none ${!canTrade ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                      onPointerDown={(e) => {
                        if (!canTrade) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pad = 9;
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / (rect.width - pad * 2)));
                        setLeverage(Math.max(1, Math.min(maxLeverage, Math.round(1 + pct * (maxLeverage - 1)))));
                      }}
                      onPointerMove={(e) => {
                        if (!canTrade || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pad = 9;
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - pad) / (rect.width - pad * 2)));
                        setLeverage(Math.max(1, Math.min(maxLeverage, Math.round(1 + pct * (maxLeverage - 1)))));
                      }}
                    >
                      <div className="absolute left-[9px] right-[9px] h-[3px] bg-surface-700 rounded-full" />
                      <div className="absolute left-[9px] h-[3px] bg-surface-400 rounded-full" style={{ width: `calc(${percent / 100} * (100% - 18px))` }} />
                      {ticks.map((t) => (
                        <div key={t} className={`absolute w-2 h-2 rounded-full -translate-x-1/2 ${t <= percent ? 'bg-surface-400' : 'bg-surface-600'}`} style={{ left: `calc(9px + ${t / 100} * (100% - 18px))` }} />
                      ))}
                      <div className="absolute w-[18px] h-[18px] rounded-full -translate-x-1/2 bg-surface-400 shadow-lg shadow-surface-400/30" style={{ left: `calc(9px + ${percent / 100} * (100% - 18px))` }}>
                        <div className="absolute inset-[3px] rounded-full bg-surface-900" />
                        <div className="absolute inset-[5px] rounded-full bg-surface-300" />
                      </div>
                    </div>
                  );
                })()}
                <div className="flex justify-between text-xs text-surface-500 mt-1">
                  <span>1x</span>
                  <span>{Math.floor(maxLeverage / 2)}x</span>
                  <span>{maxLeverage}x</span>
                </div>
                {leverage !== savedLeverage && canTrade && (
                  <p className="text-xs text-yellow-400 mt-1.5">Confirm leverage change with <span className="font-semibold">Set</span></p>
                )}
              </div>

              {/* Price Inputs */}
              {orderType !== 'market' && (
                <div className="mb-4 space-y-3">
                  {(orderType === 'stop-market' || orderType === 'stop-limit') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-surface-400">Trigger Price</label>
                        <button onClick={() => setTriggerPrice(currentPrice.toFixed(2))} disabled={!canTrade} className="text-xs font-medium text-surface-300 hover:text-white disabled:opacity-50 transition-colors">Mid</button>
                      </div>
                      <div className="relative">
                        <input type="number" value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} placeholder={selectedSide === 'LONG' ? `> ${currentPrice.toFixed(2)}` : `< ${currentPrice.toFixed(2)}`} disabled={!canTrade} className="input text-sm w-full pr-12" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">USD</span>
                      </div>
                      <p className="text-[10px] text-surface-500 mt-0.5">{selectedSide === 'LONG' ? 'Triggers when price rises above this level' : 'Triggers when price drops below this level'}</p>
                    </div>
                  )}
                  {(orderType === 'limit' || orderType === 'stop-limit') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-surface-400">{orderType === 'stop-limit' ? 'Limit Price' : 'Price'}</label>
                        <button onClick={() => setLimitPrice(currentPrice.toFixed(2))} disabled={!canTrade} className="text-xs font-medium text-surface-300 hover:text-white disabled:opacity-50 transition-colors">Mid</button>
                      </div>
                      <div className="relative">
                        <input type="number" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={currentPrice.toFixed(2)} disabled={!canTrade} className="input text-sm w-full pr-12" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">USD</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Size Input */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-surface-400 mb-2">Size</label>
                {(() => {
                  const effectiveLeverage = Math.min(leverage, maxLeverage);
                  const available = account ? parseFloat(account.availableToSpend) : 0;
                  const MARGIN_BUFFER = 0.95;
                  const closeablePosition = reduceOnly ? displayPositions.find(p => p.symbol.replace('-USD', '') === selectedMarket.replace('-USD', '') && p.side === (selectedSide === 'LONG' ? 'SHORT' : 'LONG')) : null;
                  const maxMargin = reduceOnly ? (closeablePosition ? closeablePosition.margin : 0) : available * MARGIN_BUFFER;
                  const margin = parseFloat(orderSize || '0');
                  const positionSize = margin * effectiveLeverage;
                  const tokenAmount = currentPrice > 0 ? positionSize / currentPrice : 0;
                  return (
                    <>
                      <div className="flex flex-col gap-2 mb-2">
                        <div className="flex-1 relative">
                          <input type="number" value={tokenAmount > 0 ? tokenAmount.toFixed(5) : ''} onChange={(e) => { const n = parseFloat(e.target.value) || 0; setOrderSize(((n * currentPrice) / effectiveLeverage).toFixed(2)); }} className="input text-sm w-full pr-12" placeholder="0.00" disabled={!canTrade} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-300 font-medium">{selectedMarket.replace('-USD', '')}</span>
                        </div>
                        <div className="flex-1 relative">
                          <input type="number" value={positionSize > 0 ? positionSize.toFixed(2) : ''} onChange={(e) => { const n = parseFloat(e.target.value) || 0; setOrderSize((n / effectiveLeverage).toFixed(2)); }} className="input text-sm w-full pr-12" placeholder="0.00" disabled={!canTrade} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400 font-medium">USD</span>
                        </div>
                      </div>
                      <div className="text-xs text-surface-500 mb-2 flex justify-between">
                        <span>Margin: ${margin.toFixed(2)}</span>
                        <span>Max: ${maxMargin.toFixed(2)} ({effectiveLeverage}x)</span>
                      </div>
                      {/* Percentage buttons */}
                      <div className="flex gap-2 mt-2">
                        {[25, 50, 75, 100].map((percent) => {
                          const currentPercent = maxMargin > 0 ? Math.round((margin / maxMargin) * 100) : 0;
                          const isSelected = Math.abs(currentPercent - percent) <= 2;
                          return (
                            <button key={percent} onClick={() => setOrderSize((maxMargin * percent / 100).toFixed(2))} disabled={!canTrade} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 ${isSelected ? 'bg-surface-600 text-white border border-surface-500' : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white border border-transparent'}`}>
                              {percent}%
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Reduce Only */}
              <div className="mb-4">
                <Toggle checked={reduceOnly} onChange={(checked) => { setReduceOnly(checked); if (checked) { setTpEnabled(false); setSlEnabled(false); setTakeProfit(''); setStopLoss(''); } }} disabled={!canTrade} label="Reduce Only" />
              </div>

              {/* TP/SL */}
              {(orderType === 'market' || orderType === 'limit') && !reduceOnly && (
                <div className="mb-4 space-y-3">
                  <Toggle checked={tpEnabled || slEnabled} onChange={(checked) => { setTpEnabled(checked); setSlEnabled(checked); }} disabled={!canTrade} label="Take Profit / Stop Loss" />
                  {(tpEnabled || slEnabled) && (() => {
                    const refPrice = orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice;
                    const effectiveLev = Math.min(leverage, maxLeverage);
                    const roundToTickSize = (price: number) => { const r = Math.round(price / tickSize) * tickSize; const d = tickSize >= 1 ? 0 : Math.ceil(-Math.log10(tickSize)); return r.toFixed(d); };
                    const calcTpPrice = (g: number) => { const m = (g / 100 / effectiveLev) * refPrice; return roundToTickSize(selectedSide === 'LONG' ? refPrice + m : refPrice - m); };
                    const calcSlPrice = (l: number) => { const m = (Math.abs(l) / 100 / effectiveLev) * refPrice; return roundToTickSize(selectedSide === 'LONG' ? refPrice - m : refPrice + m); };
                    return (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-surface-300">TP Price</span>
                            {takeProfit && <span className="text-xs text-surface-400">{selectedSide === 'LONG' ? `+${(((parseFloat(takeProfit) - refPrice) / refPrice) * 100 * effectiveLev).toFixed(1)}%` : `+${(((refPrice - parseFloat(takeProfit)) / refPrice) * 100 * effectiveLev).toFixed(1)}%`}</span>}
                          </div>
                          <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder={selectedSide === 'LONG' ? `> ${roundToTickSize(refPrice)}` : `< ${roundToTickSize(refPrice)}`} disabled={!canTrade} className="input text-sm w-full mb-2" />
                          <div className="flex gap-1">
                            {[25, 50, 75, 100].map((pct) => (<button key={pct} onClick={() => setTakeProfit(calcTpPrice(pct))} disabled={!canTrade} className="flex-1 py-1 text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 rounded transition-colors disabled:opacity-50">{pct}%</button>))}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-surface-300">SL Price</span>
                            {stopLoss && <span className="text-xs text-surface-400">{selectedSide === 'LONG' ? `-${(((refPrice - parseFloat(stopLoss)) / refPrice) * 100 * effectiveLev).toFixed(1)}%` : `-${(((parseFloat(stopLoss) - refPrice) / refPrice) * 100 * effectiveLev).toFixed(1)}%`}</span>}
                          </div>
                          <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder={selectedSide === 'LONG' ? `< ${roundToTickSize(refPrice)}` : `> ${roundToTickSize(refPrice)}`} disabled={!canTrade} className="input text-sm w-full mb-2" />
                          <div className="flex gap-1">
                            {[-25, -50, -75, -100].map((pct) => (<button key={pct} onClick={() => setStopLoss(calcSlPrice(pct))} disabled={!canTrade} className="flex-1 py-1 text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 rounded transition-colors disabled:opacity-50">{Math.abs(pct)}%</button>))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Slippage */}
              {orderType === 'market' && (
                <div className="mb-4 flex items-center justify-between text-xs">
                  <span className="text-surface-400">Max Slippage</span>
                  <button onClick={() => { setSlippageInput(slippage); setShowSlippageModal(true); }} className="text-surface-300 hover:text-white font-mono font-medium transition-colors">{slippage}%</button>
                </div>
              )}

              {/* Order Summary */}
              {parseFloat(orderSize || '0') > 0 && (() => {
                const effectiveLeverage = Math.min(leverage, maxLeverage);
                const margin = parseFloat(orderSize || '0');
                const positionSize = margin * effectiveLeverage;
                const feeRate = orderType === 'market' ? (parseFloat(takerFeePercent) / 100) : (parseFloat(makerFeePercent) / 100);
                const estimatedFee = positionSize * feeRate;
                const available = account ? parseFloat(account.availableToSpend) : 0;
                const marginDisplay = `$${margin.toFixed(2)}`;
                return (
                  <div className="mb-4 p-3 bg-surface-800 rounded-lg space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-surface-400">Position Size</span><span className="text-white font-mono">${positionSize.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-surface-400">Est. Fee</span><span className="text-surface-300 font-mono">${estimatedFee.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-surface-400">Margin</span><span className="text-white font-mono">{marginDisplay}</span></div>
                    <div className="flex justify-between"><span className="text-surface-400">Available</span><span className="text-white font-mono">${available.toFixed(2)}</span></div>
                  </div>
                );
              })()}

              {/* Blocked symbol warning */}
              {isSymbolBlocked && (
                <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 text-center">
                  {selectedMarket.replace('-USD', '')} is blocked - you had a position before the fight started
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={() => { handlePlaceOrder(); closeOrderSheet(); }}
                disabled={!canTrade || createMarketOrder.isPending || createLimitOrder.isPending || createStandaloneStopOrder.isPending || leverage !== savedLeverage || isSymbolBlocked}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${selectedSide === 'LONG'
                  ? 'bg-win-500 hover:bg-win-400 text-white'
                  : 'bg-[#e8566d] hover:bg-[#ec6b7e] text-white'
                  }`}
              >
                {isSymbolBlocked ? 'Symbol Blocked'
                  : (createMarketOrder.isPending || createLimitOrder.isPending || createStandaloneStopOrder.isPending) ? 'Placing Order...'
                  : (() => {
                      const label = orderType === 'market' ? '' : orderType === 'limit' ? ' Limit' : orderType === 'stop-market' ? ' Stop' : ' Stop Limit';
                      return selectedSide === 'LONG' ? `Buy / Long${label}` : `Sell / Short${label}`;
                    })()
                }
              </button>

              {/* Deposit/Withdraw buttons */}
              {isAuthenticated && pacificaConnected && account && (
                <div className="flex gap-2 mt-4">
                  <a
                    href="https://app.pacifica.fi?referral=TFC"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-surface-200 hover:text-white rounded-lg transition-colors"
                  >
                    <FileDownloadIcon sx={{ fontSize: 14 }} className="text-surface-400" />
                    Deposit
                  </a>
                  <button
                    onClick={() => { setShowWithdrawModal(true); closeOrderSheet(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-surface-700 hover:bg-surface-600 text-surface-200 hover:text-white rounded-lg transition-colors"
                  >
                    <FileUploadIcon sx={{ fontSize: 14 }} className="text-surface-400" />
                    Withdraw
                  </button>
                </div>
              )}

              {/* Account Stats — collapsible */}
              {isAuthenticated && pacificaConnected && account && (() => {
                const pacificaTakerFee = parseFloat(account.takerFee || '0.0007');
                const pacificaMakerFee = parseFloat(account.makerFee || '0.000575');
                const takerFeePercent = ((pacificaTakerFee + TRADECLUB_FEE) * 100).toFixed(4);
                const makerFeePercent = ((pacificaMakerFee + TRADECLUB_FEE) * 100).toFixed(4);
                const equity = parseFloat(account.accountEquity) || 0;
                const marginUsed = parseFloat(account.totalMarginUsed) || 0;
                const available = parseFloat(account.availableToSpend) || 0;
                const restingOrderValue = Math.max(0, equity - marginUsed - available - realtimeUnrealizedPnl);
                const totalPositionValue = displayPositions.reduce((sum, p) => sum + p.size, 0);
                const crossAccountLeverage = equity > 0 ? totalPositionValue / equity : 0;
                const maintenanceMargin = parseFloat(account.crossMmr || '0') || marginUsed * 0.5;

                return (
                  <div className="mt-4 border-t border-surface-800">
                    <button
                      onClick={() => setShowAccountStats(!showAccountStats)}
                      className="w-full flex items-center justify-between py-2 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                    >
                      <span className="font-medium">Account Info</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white">${equity.toFixed(2)}</span>
                        <svg className={`w-3.5 h-3.5 transition-transform ${showAccountStats ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {showAccountStats && (
                      <div className="pb-3 space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-surface-400">Account Equity</span><span className="text-white font-mono">${equity.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Idle Balance</span><span className="text-white font-mono">${available.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Resting Order Value</span><span className="text-white font-mono">${restingOrderValue.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Fees</span><span className="text-white font-mono">{takerFeePercent}% / {makerFeePercent}%</span></div>
                        <div className="flex justify-between">
                          <span className="text-surface-400">Unrealized PnL</span>
                          <span className={`font-mono ${realtimeUnrealizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                            {realtimeUnrealizedPnl >= 0 ? '+' : '-'}${Math.abs(realtimeUnrealizedPnl).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between"><span className="text-surface-400">Cross Leverage</span><span className="text-white font-mono">{crossAccountLeverage.toFixed(2)}x</span></div>
                        <div className="flex justify-between"><span className="text-surface-400">Maintenance Margin</span><span className="text-white font-mono">${maintenanceMargin.toFixed(2)}</span></div>
                        <div className="flex justify-between">
                          <span className="text-surface-400">Real-time Updates</span>
                          <span className={`font-mono flex items-center gap-1.5 ${pacificaWsConnected ? 'text-win-400' : 'text-surface-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pacificaWsConnected ? 'bg-win-400 animate-pulse' : 'bg-surface-500'}`} />
                            {pacificaWsConnected ? 'Live' : 'Polling'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Close Opposite Position Modal */}
      {pendingOrder?.oppositePosition && (
        <CloseOppositeModal
          isOpen={showCloseOppositeModal}
          onClose={() => {
            setShowCloseOppositeModal(false);
            setPendingOrder(null);
          }}
          onConfirm={executeOrder}
          symbol={pendingOrder.symbol}
          currentPositionSide={pendingOrder.oppositePosition.side}
          currentPositionValue={pendingOrder.oppositePosition.size}
          orderSide={pendingOrder.side}
          orderValue={pendingOrder.positionValue}
          isLoading={createMarketOrder.isPending}
        />
      )}

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableBalance={account?.availableToWithdraw ? parseFloat(account.availableToWithdraw) : null}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={showEditOrderModal}
        onClose={() => {
          setShowEditOrderModal(false);
          setEditingOrder(null);
        }}
        order={editingOrder}
      />

      {/* Margin Mode Confirmation Modal */}
      {showMarginModeModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowMarginModeModal(false); setPendingMarginMode(null); }}>
          <div className="bg-surface-900 rounded-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-5 pb-3">
              <h3 className="text-white font-semibold text-base">Margin Mode</h3>
              <button onClick={() => { setShowMarginModeModal(false); setPendingMarginMode(null); }} className="text-surface-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Radio Options */}
            <div className="px-6 space-y-3">
              {/* Isolated */}
              <button
                onClick={() => setPendingMarginMode(true)}
                className={`w-full text-left p-4 rounded-xl transition-colors ${
                  (pendingMarginMode ?? isIsolated)
                    ? 'bg-surface-800 ring-1 ring-surface-600'
                    : 'bg-surface-800/50 hover:bg-surface-800'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    (pendingMarginMode ?? isIsolated) ? 'border-white' : 'border-surface-600'
                  }`}>
                    {(pendingMarginMode ?? isIsolated) && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-white font-semibold text-sm">Isolated</span>
                </div>
                <p className="text-surface-400 text-xs leading-relaxed pl-7">
                  In isolated margin mode, a certain amount of margin will be added to the position. If the margin falls below the maintenance level, liquidation will take place.
                </p>
              </button>

              {/* Cross */}
              <button
                onClick={() => setPendingMarginMode(false)}
                className={`w-full text-left p-4 rounded-xl transition-colors ${
                  pendingMarginMode === false || (pendingMarginMode === null && !isIsolated)
                    ? 'bg-surface-800 ring-1 ring-surface-600'
                    : 'bg-surface-800/50 hover:bg-surface-800'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    pendingMarginMode === false || (pendingMarginMode === null && !isIsolated) ? 'border-white' : 'border-surface-600'
                  }`}>
                    {(pendingMarginMode === false || (pendingMarginMode === null && !isIsolated)) && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-white font-semibold text-sm">Cross</span>
                </div>
                <p className="text-surface-400 text-xs leading-relaxed pl-7">
                  In cross margin mode, margin will be shared across all positions. In the event of liquidation, traders might lose all the margin and positions settled using this asset.
                </p>
              </button>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 pt-5 pb-5 flex gap-3">
              <button
                onClick={() => { setShowMarginModeModal(false); setPendingMarginMode(null); }}
                className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarginMode}
                disabled={setMarginModeMutation.isPending || pendingMarginMode === null}
                className="flex-1 py-2.5 bg-white hover:bg-surface-200 text-black font-semibold rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {setMarginModeMutation.isPending ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slippage Modal */}
      {showSlippageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSlippageModal(false)}>
          <div className="bg-surface-900 rounded-2xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-semibold text-sm">Max Slippage</h3>
              <button onClick={() => setShowSlippageModal(false)} className="text-surface-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-surface-500 text-xs mb-4 leading-relaxed">
              Applies to market orders from the order form. Close orders use 8% and TP/SL use 10%.
            </p>
            <div className="relative mb-5">
              <input
                type="number"
                value={slippageInput}
                onChange={(e) => setSlippageInput(e.target.value)}
                min="0.01"
                max="10"
                step="0.1"
                className="w-full bg-surface-800 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-surface-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseFloat(slippageInput);
                    if (!isNaN(val) && val >= 0.01 && val <= 10) {
                      setSlippage(val.toString());
                      setShowSlippageModal(false);
                    }
                  }
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 font-mono text-sm">%</span>
            </div>
            <button
              onClick={() => {
                const val = parseFloat(slippageInput);
                if (!isNaN(val) && val >= 0.01 && val <= 10) {
                  setSlippage(val.toString());
                  setShowSlippageModal(false);
                }
              }}
              className="w-full py-2.5 bg-white text-black font-medium text-sm rounded-lg transition-colors hover:bg-surface-200"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </AppShell>
    </BetaGate>
  );
}

function TradePageLoading() {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-surface-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<TradePageLoading />}>
      <TradePageContent />
    </Suspense>
  );
}
