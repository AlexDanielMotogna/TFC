export { useAuth } from './useAuth';
export { useAccount } from './useAccount';
export { useFights } from './useFights';
export { useFight } from './useFight';
export { useSocket } from './useSocket';
export { useArenaSocket } from './useArenaSocket';
export { usePrices, usePriceConnection } from './usePrices';
// Granular price selectors (Zustand-backed, avoids full re-render on every tick)
export { usePrice, usePricesForSymbols, useMarketsList, usePriceStore } from '@/lib/store';
export { useOrderBook } from './useOrderBook';
export type { AggLevel } from './useOrderBook';
export { useCandles } from './useCandles';
export type { CandleData } from './useCandles';
export {
  useCreateMarketOrder,
  useCreateLimitOrder,
  useCancelOrder,
  useCancelStopOrder,
  useCancelAllOrders,
  useSetPositionTpSl,
  useCreateStopOrder,
  useCreateStandaloneStopOrder,
  useSetLeverage,
  useSetMarginMode,
  useWithdraw,
  useDeposit,
  useEditOrder,
  useBatchOrders,
} from './useOrders';
export type { BatchAction, BatchCreateAction, BatchCancelAction } from './useOrders';
export {
  usePositions,
  useAccountInfo,
  useAccountSettings,
  useOpenOrders,
  useMarkets,
  useMarket,
  useTradeHistory,
  useOrderHistory,
} from './usePositions';
export { usePacificaConnection } from './usePacificaConnection';
export { useBuilderCodeStatus, useApproveBuilderCode, getBuilderCode } from './useBuilderCode';
export { useStakeInfo } from './useStakeInfo';
export { useMyActiveFights } from './useMyActiveFights';
export { useFightPositions } from './useFightPositions';
export { useFightTrades } from './useFightTrades';
export { useFightOrders } from './useFightOrders';
export { useFightOrderHistory } from './useFightOrderHistory';
export { useGlobalSocket, useGlobalSocketStore, useFightRoom } from './useGlobalSocket';
export { usePacificaWebSocket, usePacificaWsStore } from './usePacificaWebSocket';
export type {
  Position as PacificaPosition,
  Order as PacificaOrder,
  Trade as PacificaTrade,
} from './usePacificaWebSocket';
export { useExchangeWsStore, useExchangeWebSocket } from './useExchangeWebSocket';
export {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from './useNotifications';
export type { Notification } from './useNotifications';
export { useMyPrizes } from './useMyPrizes';
export type { UserPrize } from './useMyPrizes';
export { useBetaAccess } from './useBetaAccess';
export { useUrlState, useMultipleUrlState } from './useUrlState';
export type { UseUrlStateOptions } from './useUrlState';
export { useSettings } from './useSettings';
export type { Settings } from './useSettings';
export { useCanTrade } from './useCanTrade';
